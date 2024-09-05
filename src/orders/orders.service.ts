import { HttpStatus, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { PrismaClient } from '@prisma/client';
import { RpcException } from '@nestjs/microservices';
import { OrderPaginationDto } from './dto/order-pagination.dto';
import { ChangeOrdeStatusDto } from './dto';

@Injectable()
export class OrdersService extends PrismaClient implements OnModuleInit {

  private readonly logger = new Logger('ProductsService');

  onModuleInit() {
    this.$connect();
    this.logger.log("database connected");
  }
  
  create(createOrderDto: CreateOrderDto) {
    return this.order.create({
      data: createOrderDto
    });
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
      where: { id }
    })

    if (!order){
      throw new RpcException({
        status: HttpStatus.NOT_FOUND,
        message: `Order with id #${id} not found`

      });
    }

    return order;
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
