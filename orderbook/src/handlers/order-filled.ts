import { dataSource } from '@graphprotocol/graph-ts';
import { OrderFilled as OrderFilledEvent } from '../../generated/OrderBook/OrderBook';
import { Fill } from '../../generated/schema';
import { getOrCreateOrder } from '../entities/order';
import { getOrCreateSolver } from '../entities/solver';
import { createEventId, ZERO } from '../utils';

export function handleOrderFilled(event: OrderFilledEvent): void {
    const orderId = event.params.orderId;
    const solverAddress = event.params.solver;
    const amountInToRelease = event.params.amountInToRelease;
    const amountOutFilled = event.params.amountOutFilled;
    const messageId = event.params.messageId;

    // Get current chain ID (this is the destination chain)
    const destChainId = dataSource.context().getI32('chainId');

    // Load or create the order (may not exist yet if this is first event on dest chain)
    // We use destChainId for both since we don't know origin chain from this event
    const order = getOrCreateOrder(orderId, 0, destChainId);

    // Update order fill totals
    order.amountOutFilled = order.amountOutFilled.plus(amountOutFilled);

    // Determine if this is a partial fill
    const isPartialFill = order.amountOut !== null && order.amountOutFilled.lt(order.amountOut!);

    // Update status
    if (order.amountOut !== null && order.amountOutFilled.ge(order.amountOut!)) {
        order.status = 'COMPLETED';
        order.completedAt = event.block.timestamp;
    } else if (order.amountOutFilled.gt(ZERO)) {
        order.status = 'PARTIALLY_FILLED';
    }

    order.save();

    // Update solver stats
    const solver = getOrCreateSolver(solverAddress);
    solver.totalFills = solver.totalFills + 1;
    solver.totalVolumeOut = solver.totalVolumeOut.plus(amountOutFilled);
    solver.totalVolumeIn = solver.totalVolumeIn.plus(amountInToRelease);
    solver.save();

    // Create immutable Fill record
    const fillId = createEventId(event);
    const fill = new Fill(fillId);
    fill.order = orderId;
    fill.orderId = orderId;
    fill.solver = solverAddress;
    fill.solverAddress = solverAddress;
    fill.amountInToRelease = amountInToRelease;
    fill.amountOutFilled = amountOutFilled;
    fill.messageId = messageId;
    fill.isPartialFill = isPartialFill;
    fill.timestamp = event.block.timestamp;
    fill.blockNumber = event.block.number;
    fill.transactionHash = event.transaction.hash;
    fill.save();
}
