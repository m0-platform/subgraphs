import { BigInt, Bytes } from '@graphprotocol/graph-ts';
import { CancellationSnapshot } from '../../generated/schema';
import { TIMESERIES_ID } from '../utils';

class CreateCancellationSnapshotArgs {
    orderId: Bytes;
    blockNumber: BigInt;
    transactionHash: Bytes;
    logIndex: BigInt;
}

export function createCancellationSnapshot(args: CreateCancellationSnapshotArgs): CancellationSnapshot {
    const snap = new CancellationSnapshot(TIMESERIES_ID);
    snap.orderId = args.orderId;
    snap.blockNumber = args.blockNumber;
    snap.transactionHash = args.transactionHash;
    snap.logIndex = args.logIndex;
    snap.save();

    return snap;
}
