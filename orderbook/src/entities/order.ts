import { BigInt, Bytes } from '@graphprotocol/graph-ts';
import { Order } from '../../generated/schema';
import { ZERO } from '../utils';

export function getOrCreateOrder(orderId: Bytes, originChainId: i32, destChainId: i32): Order {
    let order = Order.load(orderId);

    if (order) return order;

    order = new Order(orderId);
    order.sender = null;
    order.originChainId = originChainId;
    order.destChainId = destChainId;
    order.tokenIn = null;
    order.tokenOut = null;
    order.amountIn = null;
    order.amountOut = null;
    order.amountInReleased = ZERO;
    order.amountInRefunded = ZERO;
    order.amountOutFilled = ZERO;
    order.status = 'CREATED';
    order.isLocalOrder = originChainId == destChainId;
    order.createdAt = null;
    order.completedAt = null;
    order.solver = null;
    order.recipient = null;

    return order;
}

export function loadOrder(orderId: Bytes): Order | null {
    return Order.load(orderId);
}
