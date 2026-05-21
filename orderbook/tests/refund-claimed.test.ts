import { assert, describe, test, beforeEach, clearStore } from 'matchstick-as';
import { Address, BigInt, Bytes } from '@graphprotocol/graph-ts';
import { Order, Refund } from '../generated/schema';
import { getOrCreateOrder } from '../src/entities/order';

const MOCK_ADDRESS = Address.fromString('0x0000000000000000000000000000000000000001');
const MOCK_BYTES32 = Bytes.fromHexString('0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef');

describe('RefundClaimed Logic', () => {
    beforeEach(() => {
        clearStore();
    });

    test('creates Refund entity', () => {
        const orderId = MOCK_BYTES32;
        const sender = MOCK_ADDRESS;
        const amountInRefunded = BigInt.fromI32(500);
        const refundId = Bytes.fromHexString('0x0001');

        const refund = new Refund(refundId);
        refund.order = orderId;
        refund.orderId = orderId;
        refund.sender = sender;
        refund.amountInRefunded = amountInRefunded;
        refund.timestamp = BigInt.fromI32(1000000);
        refund.blockNumber = BigInt.fromI32(100);
        refund.transactionHash = MOCK_BYTES32;
        refund.save();

        assert.entityCount('Refund', 1);
        assert.fieldEquals('Refund', refundId.toHexString(), 'amountInRefunded', amountInRefunded.toString());
        assert.fieldEquals('Refund', refundId.toHexString(), 'sender', sender.toHexString());
    });

    test('updates Order amountInRefunded', () => {
        const orderId = MOCK_BYTES32;
        const amountInRefunded = BigInt.fromI32(500);

        // Create order first
        const order = getOrCreateOrder(orderId, 1, 8453);
        order.amountIn = BigInt.fromI32(1000);
        order.save();

        // Claim refund
        const orderLoaded = getOrCreateOrder(orderId, 1, 8453);
        orderLoaded.amountInRefunded = orderLoaded.amountInRefunded.plus(amountInRefunded);
        orderLoaded.save();

        assert.fieldEquals('Order', orderId.toHexString(), 'amountInRefunded', amountInRefunded.toString());
    });

    test('handles partial fill then refund scenario', () => {
        const orderId = MOCK_BYTES32;
        const amountIn = BigInt.fromI32(1000);
        const amountInReleased = BigInt.fromI32(500); // Half released
        const amountInRefunded = BigInt.fromI32(500); // Half refunded

        // Create order
        const order = getOrCreateOrder(orderId, 1, 8453);
        order.amountIn = amountIn;
        order.save();

        // Partial fill
        const orderAfterFill = getOrCreateOrder(orderId, 1, 8453);
        orderAfterFill.amountInReleased = amountInReleased;
        orderAfterFill.amountOutFilled = BigInt.fromI32(495);
        orderAfterFill.status = 'PARTIALLY_FILLED';
        orderAfterFill.save();

        // Refund remaining
        const orderAfterRefund = getOrCreateOrder(orderId, 1, 8453);
        orderAfterRefund.amountInRefunded = orderAfterRefund.amountInRefunded.plus(amountInRefunded);
        orderAfterRefund.save();

        assert.fieldEquals('Order', orderId.toHexString(), 'amountOutFilled', '495');
        assert.fieldEquals('Order', orderId.toHexString(), 'amountInReleased', amountInReleased.toString());
        assert.fieldEquals('Order', orderId.toHexString(), 'amountInRefunded', amountInRefunded.toString());
    });

    test('accumulates refunds for same order', () => {
        const orderId = MOCK_BYTES32;

        // Create order
        const order = getOrCreateOrder(orderId, 1, 8453);
        order.amountIn = BigInt.fromI32(1000);
        order.save();

        // First refund
        const order1 = getOrCreateOrder(orderId, 1, 8453);
        order1.amountInRefunded = order1.amountInRefunded.plus(BigInt.fromI32(300));
        order1.save();

        // Second refund
        const order2 = getOrCreateOrder(orderId, 1, 8453);
        order2.amountInRefunded = order2.amountInRefunded.plus(BigInt.fromI32(200));
        order2.save();

        assert.fieldEquals('Order', orderId.toHexString(), 'amountInRefunded', '500'); // 300 + 200
    });
});
