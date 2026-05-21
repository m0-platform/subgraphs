import { FillReported as FillReportedEvent } from '../../generated/OrderBook/OrderBook';
import { loadOrder } from '../entities/order';
import { createFillSnapshot } from '../creators/fill-snapshot';
import { ZERO, ZERO_ADDRESS } from '../utils';

export function handleFillReported(event: FillReportedEvent): void {
    const orderId = event.params.orderId;
    const originRecipient = event.params.originRecipient;
    const amountInToRelease = event.params.amountInToRelease;
    const amountOutFilled = event.params.amountOutFilled;

    // Load the order (should exist on origin chain)
    const order = loadOrder(orderId);
    if (order === null) {
        // Should not happen on origin chain, but handle gracefully
        return;
    }

    // Update released amount
    order.amountInReleased = order.amountInReleased.plus(amountInToRelease);
    order.amountOutFilled = order.amountOutFilled.plus(amountOutFilled);

    // Update recipient if not set
    if (order.recipient === null) {
        order.recipient = originRecipient;
    }

    // Update status based on fill progress
    if (order.amountOut !== null && order.amountOutFilled.ge(order.amountOut!)) {
        order.status = 'COMPLETED';
        order.completedAt = event.block.timestamp;
    } else if (order.amountOutFilled.gt(ZERO)) {
        order.status = 'PARTIALLY_FILLED';
    }

    order.save();

    // Create fill snapshot for aggregations
    // Note: tokenIn/tokenOut might be null if order doesn't have full data
    const tokenIn = order.tokenIn !== null ? order.tokenIn! : ZERO_ADDRESS;
    const tokenOut = order.tokenOut !== null ? order.tokenOut! : ZERO_ADDRESS;

    createFillSnapshot({
        orderId: orderId,
        solver: ZERO_ADDRESS, // Solver not available in this event
        amountInReleased: amountInToRelease,
        amountOutFilled: amountOutFilled,
        tokenIn: tokenIn,
        tokenOut: tokenOut,
        originChainId: order.originChainId,
        destChainId: order.destChainId,
        blockNumber: event.block.number,
        transactionHash: event.transaction.hash,
        logIndex: event.logIndex,
    });
}
