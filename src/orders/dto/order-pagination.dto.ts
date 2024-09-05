import { IsEnum, IsOptional } from "class-validator";
import { PaginationDto } from "src/common";
import { orderStatusList } from "../enum/order.enum";
import { OrderStatus } from "@prisma/client";

export class OrderPaginationDto extends PaginationDto {
    @IsOptional()
    @IsEnum(orderStatusList , {
        message: `Valid status are ${orderStatusList}`
    })
    status: OrderStatus;

}