import { RefundClaimed as RefundClaimedEvent } from '../../generated/OrderBook/OrderBook';
import { Refund } from '../../generated/schema';
import { loadOrder } from '../entities/order';
import { createEventId } from '../utils';
import { createRefundSnapshot } from '../creators/refund-snapshot';

export function handleRefundClaimed(event: RefundClaimedEvent): void {
    const orderId = event.params.orderId;
    const sender = event.params.sender;
    const amountInRefunded = event.params.amountInRefunded;

    // Update order refund amount
    const order = loadOrder(orderId);
    if (order !== null) {
        order.amountInRefunded = order.amountInRefunded.plus(amountInRefunded);
        order.save();
    }

    // Create immutable Refund record
    const refundId = createEventId(event);
    const refund = new Refund(refundId);
    refund.order = orderId;
    refund.orderId = orderId;
    refund.sender = sender;
    refund.amountInRefunded = amountInRefunded;
    refund.timestamp = event.block.timestamp;
    refund.blockNumber = event.block.number;
    refund.transactionHash = event.transaction.hash;
    refund.save();

    // Create timeseries snapshot for aggregations
    createRefundSnapshot({
        orderId: orderId,
        sender: sender,
        amountInRefunded: amountInRefunded,
        blockNumber: event.block.number,
        transactionHash: event.transaction.hash,
        logIndex: event.logIndex,
    });
}
