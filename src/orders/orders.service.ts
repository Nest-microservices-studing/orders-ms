import { HttpStatus, Inject, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { PrismaClient } from '@prisma/client';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { OrderPaginationDto } from './dto/order-pagination.dto';
import { ChangeOrdeStatusDto } from './dto';
import { NATS_SERVICE } from 'src/config';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class OrdersService extends PrismaClient implements OnModuleInit {

  private readonly logger = new Logger('OrdersService');

  constructor(@Inject(NATS_SERVICE) private readonly productsClient: ClientProxy) {
    super();
  }


  onModuleInit() {
    this.$connect();
    this.logger.log("database connected");
  }
  
  async create(createOrderDto: CreateOrderDto) {
    try {
      // 1. Obtener los IDs de los productos y confirmar su existencia en una sola operación
      const productIds = createOrderDto.items.map(item => item.productId);
      const products = await firstValueFrom(this.productsClient.send({ cmd: 'validate_products' }, productIds));
  
      // 2. Calcular los valores totales y validar productos utilizando `find`
      let totalAmount = 0;
      let totalItems = 0;
  
      const orderItemsData = createOrderDto.items.map(orderItem => {
        // Usar find para obtener el producto
        const product = products.find(product => product.id === orderItem.productId);
        
        if (!product) {
          throw new RpcException({
            status: HttpStatus.BAD_REQUEST,
            message: `Product with ID ${orderItem.productId} not found`
          });
        }
  
        const amount = product.price * orderItem.quantity;
        totalAmount += amount;
        totalItems += orderItem.quantity;
  
        return {
          price: product.price,
          productId: orderItem.productId,
          quantity: orderItem.quantity
        };
      });
  
      // 3. Crear la orden y los elementos de la orden en una transacción única
      const order = await this.order.create({
        data: {
          totalAmount,
          totalItems,
          OrderItem: {
            createMany: { data: orderItemsData }
          }
        },
        include: {
          OrderItem: {
            select: {
              productId: true,
              price: true,
              quantity: true,
            }
          }
        }
      });
  
      // 4. Añadir los nombres de los productos en el resultado final
      return {
        ...order,
        OrderItem: order.OrderItem.map(orderItem => {
          // Usar find para obtener el nombre del producto
          const product = products.find(product => product.id === orderItem.productId);
          return {
            ...orderItem,
            name: product ? product.name : 'Unknown'
          };
        }),
      };
  
    } catch (error) {
      throw new RpcException({
        status: HttpStatus.BAD_REQUEST,
        message: 'Check Logs'
      });
    }
  }
  

  async findAll(orderPaginationDto: OrderPaginationDto) {
    const statusOrder = orderPaginationDto.status

    const totalPages = await this.order.count({
      where: {
        status: statusOrder
      }
    });

    const currentPage = orderPaginationDto.page;
    const perPage = orderPaginationDto.limit;

    return {
      data: await this.order.findMany({
        skip: (currentPage - 1) * perPage,
        take: perPage,
        where: {
          status: statusOrder
        }
      }),
      meta: {
        total: totalPages,
        page: currentPage,
        lastPage: Math.ceil(totalPages / perPage)
      }

    }
  }

  async findOne(id: string) {
    const order = await this.order.findUnique({
      where: { id },
      include: {
        OrderItem: {
          select: {
            productId: true,
            price: true,
            quantity: true
          }
        }

      }
    })

    if (!order){
      throw new RpcException({
        status: HttpStatus.NOT_FOUND,
        message: `Order with id #${id} not found`

      });
    }

    const productIds = order.OrderItem.map(orderItem => orderItem.productId);
    const products = await firstValueFrom(this.productsClient.send({ cmd: 'validate_products' }, productIds));

    return {
      ...order,
      OrderItem: order.OrderItem.map(orderItem => ({
        ...orderItem,
        name: products.find(product => product.id === orderItem.productId).name
      })),
    };
  }

  async changeStatus(changeOrderStatus: ChangeOrdeStatusDto){
    const {id, status} = changeOrderStatus;

    const order = await this.findOne(id);

    return this.order.update({
      where: {id},
      data: {status:status}
    });

  }
}
