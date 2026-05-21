import { BigInt, Bytes } from '@graphprotocol/graph-ts';
import { RefundSnapshot } from '../../generated/schema';
import { TIMESERIES_ID } from '../utils';

class CreateRefundSnapshotArgs {
    orderId: Bytes;
    sender: Bytes;
    amountInRefunded: BigInt;
    blockNumber: BigInt;
    transactionHash: Bytes;
    logIndex: BigInt;
}

export function createRefundSnapshot(args: CreateRefundSnapshotArgs): RefundSnapshot {
    const snap = new RefundSnapshot(TIMESERIES_ID);
    snap.orderId = args.orderId;
    snap.sender = args.sender;
    snap.amountInRefunded = args.amountInRefunded;
    snap.blockNumber = args.blockNumber;
    snap.transactionHash = args.transactionHash;
    snap.logIndex = args.logIndex;
    snap.save();

    return snap;
}
