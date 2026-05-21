import { CancelReported as CancelReportedEvent } from '../../generated/OrderBook/OrderBook';
import { loadOrder } from '../entities/order';
import { createCancellationSnapshot } from '../creators/cancellation-snapshot';

export function handleCancelReported(event: CancelReportedEvent): void {
    const orderId = event.params.orderId;

    // Update order status if it exists
    const order = loadOrder(orderId);
    if (order !== null) {
        order.status = 'CANCELLED';
        order.save();
    }

    // Create timeseries snapshot for aggregations
    createCancellationSnapshot({
        orderId: orderId,
        blockNumber: event.block.number,
        transactionHash: event.transaction.hash,
        logIndex: event.logIndex,
    });
}
