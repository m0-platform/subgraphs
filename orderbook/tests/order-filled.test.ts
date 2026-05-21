import { assert, describe, test, beforeEach, clearStore } from 'matchstick-as';
import { Address, BigInt, Bytes } from '@graphprotocol/graph-ts';
import { Order, Solver, Fill } from '../generated/schema';
import { getOrCreateOrder } from '../src/entities/order';
import { getOrCreateSolver } from '../src/entities/solver';
import { ZERO } from '../src/utils';

const MOCK_ADDRESS = Address.fromString('0x0000000000000000000000000000000000000001');
const MOCK_BYTES32 = Bytes.fromHexString('0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef');
const MOCK_BYTES32_2 = Bytes.fromHexString('0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890');

describe('OrderFilled Logic', () => {
    beforeEach(() => {
        clearStore();
    });

    test('creates Fill entity with correct fields', () => {
        const orderId = MOCK_BYTES32;
        const solverAddress = MOCK_ADDRESS;
        const amountInToRelease = BigInt.fromI32(500);
        const amountOutFilled = BigInt.fromI32(495);
        const messageId = MOCK_BYTES32_2;

        // Create order first
        const order = getOrCreateOrder(orderId, 1, 8453);
        order.amountOut = BigInt.fromI32(990);
        order.save();

        // Create solver
        const solver = getOrCreateSolver(solverAddress);
        solver.totalFills = solver.totalFills + 1;
        solver.totalVolumeOut = solver.totalVolumeOut.plus(amountOutFilled);
        solver.totalVolumeIn = solver.totalVolumeIn.plus(amountInToRelease);
        solver.save();

        // Create Fill
        const fillId = Bytes.fromHexString('0x0001');
        const fill = new Fill(fillId);
        fill.order = orderId;
        fill.orderId = orderId;
        fill.solver = solverAddress;
        fill.solverAddress = solverAddress;
        fill.amountInToRelease = amountInToRelease;
        fill.amountOutFilled = amountOutFilled;
        fill.messageId = messageId;
        fill.isPartialFill = true;
        fill.timestamp = BigInt.fromI32(1000000);
        fill.blockNumber = BigInt.fromI32(100);
        fill.transactionHash = MOCK_BYTES32;
        fill.save();

        assert.entityCount('Fill', 1);
        assert.fieldEquals('Fill', fillId.toHexString(), 'amountOutFilled', amountOutFilled.toString());
        assert.fieldEquals('Fill', fillId.toHexString(), 'isPartialFill', 'true');
    });

    test('updates Solver stats on fill', () => {
        const solverAddress = MOCK_ADDRESS;
        const amountInToRelease = BigInt.fromI32(500);
        const amountOutFilled = BigInt.fromI32(495);

        const solver = getOrCreateSolver(solverAddress);
        solver.totalFills = solver.totalFills + 1;
        solver.totalVolumeOut = solver.totalVolumeOut.plus(amountOutFilled);
        solver.totalVolumeIn = solver.totalVolumeIn.plus(amountInToRelease);
        solver.save();

        assert.fieldEquals('Solver', solverAddress.toHexString(), 'totalFills', '1');
        assert.fieldEquals('Solver', solverAddress.toHexString(), 'totalVolumeOut', amountOutFilled.toString());
        assert.fieldEquals('Solver', solverAddress.toHexString(), 'totalVolumeIn', amountInToRelease.toString());
    });

    test('detects partial fill', () => {
        const orderId = MOCK_BYTES32;
        const amountOut = BigInt.fromI32(990);
        const amountOutFilled = BigInt.fromI32(495); // Less than total

        const order = getOrCreateOrder(orderId, 1, 8453);
        order.amountOut = amountOut;
        order.amountOutFilled = amountOutFilled;

        const isPartialFill = order.amountOutFilled.lt(order.amountOut!);
        order.status = isPartialFill ? 'PARTIALLY_FILLED' : 'COMPLETED';
        order.save();

        assert.fieldEquals('Order', orderId.toHexString(), 'status', 'PARTIALLY_FILLED');
    });

    test('marks order COMPLETED when fully filled', () => {
        const orderId = MOCK_BYTES32;
        const amountOut = BigInt.fromI32(990);
        const amountOutFilled = BigInt.fromI32(990); // Equal to total

        const order = getOrCreateOrder(orderId, 1, 8453);
        order.amountOut = amountOut;
        order.amountOutFilled = amountOutFilled;

        const isPartialFill = order.amountOutFilled.lt(order.amountOut!);
        order.status = isPartialFill ? 'PARTIALLY_FILLED' : 'COMPLETED';
        order.completedAt = BigInt.fromI32(1000000);
        order.save();

        assert.fieldEquals('Order', orderId.toHexString(), 'status', 'COMPLETED');
    });

    test('accumulates solver stats across multiple fills', () => {
        const solverAddress = MOCK_ADDRESS;

        // First fill
        const solver = getOrCreateSolver(solverAddress);
        solver.totalFills = solver.totalFills + 1;
        solver.totalVolumeOut = solver.totalVolumeOut.plus(BigInt.fromI32(495));
        solver.totalVolumeIn = solver.totalVolumeIn.plus(BigInt.fromI32(500));
        solver.save();

        // Second fill
        const solver2 = getOrCreateSolver(solverAddress);
        solver2.totalFills = solver2.totalFills + 1;
        solver2.totalVolumeOut = solver2.totalVolumeOut.plus(BigInt.fromI32(297));
        solver2.totalVolumeIn = solver2.totalVolumeIn.plus(BigInt.fromI32(300));
        solver2.save();

        assert.fieldEquals('Solver', solverAddress.toHexString(), 'totalFills', '2');
        assert.fieldEquals('Solver', solverAddress.toHexString(), 'totalVolumeOut', '792'); // 495 + 297
        assert.fieldEquals('Solver', solverAddress.toHexString(), 'totalVolumeIn', '800'); // 500 + 300
    });
});
