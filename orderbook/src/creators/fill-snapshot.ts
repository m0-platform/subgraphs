import { BigInt, Bytes } from '@graphprotocol/graph-ts';
import { FillSnapshot } from '../../generated/schema';
import { TIMESERIES_ID } from '../utils';

class CreateFillSnapshotArgs {
    orderId: Bytes;
    solver: Bytes;
    amountInReleased: BigInt;
    amountOutFilled: BigInt;
    tokenIn: Bytes;
    tokenOut: Bytes;
    originChainId: i32;
    destChainId: i32;
    blockNumber: BigInt;
    transactionHash: Bytes;
    logIndex: BigInt;
}

export function createFillSnapshot(args: CreateFillSnapshotArgs): FillSnapshot {
    const snap = new FillSnapshot(TIMESERIES_ID);
    snap.orderId = args.orderId;
    snap.solver = args.solver;
    snap.amountInReleased = args.amountInReleased;
    snap.amountOutFilled = args.amountOutFilled;
    snap.tokenIn = args.tokenIn;
    snap.tokenOut = args.tokenOut;
    snap.originChainId = args.originChainId;
    snap.destChainId = args.destChainId;
    snap.blockNumber = args.blockNumber;
    snap.transactionHash = args.transactionHash;
    snap.logIndex = args.logIndex;
    snap.save();

    return snap;
}
