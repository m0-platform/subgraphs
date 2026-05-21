import { BigInt, Bytes } from '@graphprotocol/graph-ts';
import { OrderSnapshot } from '../../generated/schema';
import { TIMESERIES_ID } from '../utils';

class CreateOrderSnapshotArgs {
    orderId: Bytes;
    sender: Bytes;
    tokenIn: Bytes;
    tokenOut: Bytes;
    amountIn: BigInt;
    amountOut: BigInt;
    originChainId: i32;
    destChainId: i32;
    blockNumber: BigInt;
    transactionHash: Bytes;
    logIndex: BigInt;
}

export function createOrderSnapshot(args: CreateOrderSnapshotArgs): OrderSnapshot {
    const snap = new OrderSnapshot(TIMESERIES_ID);
    snap.orderId = args.orderId;
    snap.sender = args.sender;
    snap.tokenIn = args.tokenIn;
    snap.tokenOut = args.tokenOut;
    snap.amountIn = args.amountIn;
    snap.amountOut = args.amountOut;
    snap.originChainId = args.originChainId;
    snap.destChainId = args.destChainId;
    snap.blockNumber = args.blockNumber;
    snap.transactionHash = args.transactionHash;
    snap.logIndex = args.logIndex;
    snap.save();

    return snap;
}
