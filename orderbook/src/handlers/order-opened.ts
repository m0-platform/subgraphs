import { dataSource } from '@graphprotocol/graph-ts';
import { OrderOpened as OrderOpenedEvent } from '../../generated/OrderBook/OrderBook';
import { getOrCreateOrder } from '../entities/order';
import { getOrCreateToken } from '../entities/token';
import { getOrCreateChainRoute } from '../entities/chain-route';
import { createOrderSnapshot } from '../creators/order-snapshot';
import { bytes32ToAddress, isZeroBytes32 } from '../utils';

export function handleOrderOpened(event: OrderOpenedEvent): void {
    const orderId = event.params.orderId;
    const sender = event.params.sender;
    const tokenIn = event.params.tokenIn;
    const amountIn = event.params.amountIn;
    const destChainId = event.params.destChainId.toI32();
    const tokenOut = event.params.tokenOut;
    const amountOut = event.params.amountOut;
    const solver = event.params.solver;

    // Get current chain ID from context
    const originChainId = dataSource.context().getI32('chainId');

    // Create or load the order
    const order = getOrCreateOrder(orderId, originChainId, destChainId);
    order.sender = sender;
    order.tokenIn = tokenIn;
    order.tokenOut = bytes32ToAddress(tokenOut);
    order.amountIn = amountIn;
    order.amountOut = amountOut;
    order.createdAt = event.block.timestamp;
    order.status = 'CREATED';
    order.isLocalOrder = originChainId == destChainId;

    // Set designated solver if specified (non-zero)
    if (!isZeroBytes32(solver)) {
        order.solver = bytes32ToAddress(solver);
    }

    order.save();

    // Update token stats
    const tokenInEntity = getOrCreateToken(tokenIn);
    tokenInEntity.orderCountAsInput = tokenInEntity.orderCountAsInput + 1;
    tokenInEntity.totalVolumeIn = tokenInEntity.totalVolumeIn.plus(amountIn);
    tokenInEntity.netFlow = tokenInEntity.totalVolumeIn.minus(tokenInEntity.totalVolumeOut);
    tokenInEntity.save();

    const tokenOutEntity = getOrCreateToken(bytes32ToAddress(tokenOut));
    tokenOutEntity.orderCountAsOutput = tokenOutEntity.orderCountAsOutput + 1;
    tokenOutEntity.totalVolumeOut = tokenOutEntity.totalVolumeOut.plus(amountOut);
    tokenOutEntity.netFlow = tokenOutEntity.totalVolumeIn.minus(tokenOutEntity.totalVolumeOut);
    tokenOutEntity.save();

    // Update chain route stats
    const route = getOrCreateChainRoute(originChainId, destChainId);
    route.totalOrders = route.totalOrders + 1;
    route.totalVolumeIn = route.totalVolumeIn.plus(amountIn);
    route.totalVolumeOut = route.totalVolumeOut.plus(amountOut);
    route.save();

    // Create timeseries snapshot
    createOrderSnapshot({
        orderId: orderId,
        sender: sender,
        tokenIn: tokenIn,
        tokenOut: bytes32ToAddress(tokenOut),
        amountIn: amountIn,
        amountOut: amountOut,
        originChainId: originChainId,
        destChainId: destChainId,
        blockNumber: event.block.number,
        transactionHash: event.transaction.hash,
        logIndex: event.logIndex,
    });
}
