import { OrderCompleted as OrderCompletedEvent } from '../../generated/OrderBook/OrderBook';
import { loadOrder } from '../entities/order';

export function handleOrderCompleted(event: OrderCompletedEvent): void {
    const orderId = event.params.orderId;

    const order = loadOrder(orderId);
    if (order === null) {
        // Order may not exist on this chain if we're on destination chain
        // and order was created on origin chain
        return;
    }

    order.status = 'COMPLETED';
    order.completedAt = event.block.timestamp;
    order.save();
}
