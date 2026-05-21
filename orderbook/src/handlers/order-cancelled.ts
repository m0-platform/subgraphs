import { OrderCancelled as OrderCancelledEvent } from '../../generated/OrderBook/OrderBook';
import { Cancellation } from '../../generated/schema';
import { loadOrder } from '../entities/order';
import { createEventId } from '../utils';
import { createCancellationSnapshot } from '../creators/cancellation-snapshot';

export function handleOrderCancelled(event: OrderCancelledEvent): void {
    const orderId = event.params.orderId;
    const messageId = event.params.messageId;

    // Update order status if it exists
    const order = loadOrder(orderId);
    if (order !== null) {
        order.status = 'CANCELLED';
        order.save();
    }

    // Create immutable Cancellation record
    const cancellationId = createEventId(event);
    const cancellation = new Cancellation(cancellationId);
    cancellation.orderId = orderId;
    cancellation.messageId = messageId;
    cancellation.timestamp = event.block.timestamp;
    cancellation.blockNumber = event.block.number;
    cancellation.transactionHash = event.transaction.hash;
    cancellation.save();

    // Create timeseries snapshot
    createCancellationSnapshot({
        orderId: orderId,
        blockNumber: event.block.number,
        transactionHash: event.transaction.hash,
        logIndex: event.logIndex,
    });
}
