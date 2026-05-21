import { assert, describe, test, beforeEach, clearStore } from 'matchstick-as';
import { Address, BigInt, Bytes } from '@graphprotocol/graph-ts';
import { Order, Cancellation } from '../generated/schema';
import { getOrCreateOrder } from '../src/entities/order';

const MOCK_BYTES32 = Bytes.fromHexString('0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef');
const MOCK_BYTES32_2 = Bytes.fromHexString('0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890');

describe('OrderCancelled Logic', () => {
    beforeEach(() => {
        clearStore();
    });

    test('creates Cancellation entity', () => {
        const orderId = MOCK_BYTES32;
        const messageId = MOCK_BYTES32_2;
        const cancellationId = Bytes.fromHexString('0x0001');

        const cancellation = new Cancellation(cancellationId);
        cancellation.orderId = orderId;
        cancellation.messageId = messageId;
        cancellation.timestamp = BigInt.fromI32(1000000);
        cancellation.blockNumber = BigInt.fromI32(100);
        cancellation.transactionHash = MOCK_BYTES32;
        cancellation.save();

        assert.entityCount('Cancellation', 1);
        assert.fieldEquals('Cancellation', cancellationId.toHexString(), 'orderId', orderId.toHexString());
        assert.fieldEquals('Cancellation', cancellationId.toHexString(), 'messageId', messageId.toHexString());
    });

    test('updates Order status to CANCELLED', () => {
        const orderId = MOCK_BYTES32;

        // Create order first
        const order = getOrCreateOrder(orderId, 1, 8453);
        order.status = 'CREATED';
        order.save();

        // Cancel it
        const orderLoaded = getOrCreateOrder(orderId, 1, 8453);
        orderLoaded.status = 'CANCELLED';
        orderLoaded.save();

        assert.fieldEquals('Order', orderId.toHexString(), 'status', 'CANCELLED');
    });

    test('can cancel PARTIALLY_FILLED order', () => {
        const orderId = MOCK_BYTES32;

        // Create order and partially fill it
        const order = getOrCreateOrder(orderId, 1, 8453);
        order.amountOut = BigInt.fromI32(990);
        order.amountOutFilled = BigInt.fromI32(495);
        order.status = 'PARTIALLY_FILLED';
        order.save();

        // Cancel it
        const orderLoaded = getOrCreateOrder(orderId, 1, 8453);
        orderLoaded.status = 'CANCELLED';
        orderLoaded.save();

        assert.fieldEquals('Order', orderId.toHexString(), 'status', 'CANCELLED');
        assert.fieldEquals('Order', orderId.toHexString(), 'amountOutFilled', '495');
    });
});
