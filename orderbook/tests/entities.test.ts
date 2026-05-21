import { assert, describe, test, beforeEach, clearStore } from 'matchstick-as';
import { Address, BigInt, Bytes } from '@graphprotocol/graph-ts';
import { getOrCreateOrder } from '../src/entities/order';
import { getOrCreateSolver } from '../src/entities/solver';
import { getOrCreateToken } from '../src/entities/token';
import { getOrCreateChainRoute } from '../src/entities/chain-route';
import { ZERO } from '../src/utils';

describe('Entity Helpers', () => {
    beforeEach(() => {
        clearStore();
    });

    test('getOrCreateOrder creates new order with correct defaults', () => {
        const orderId = Bytes.fromHexString('0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef');
        const originChainId = 1;
        const destChainId = 8453;

        const order = getOrCreateOrder(orderId, originChainId, destChainId);
        order.save();

        assert.entityCount('Order', 1);
        assert.fieldEquals('Order', orderId.toHexString(), 'originChainId', '1');
        assert.fieldEquals('Order', orderId.toHexString(), 'destChainId', '8453');
        assert.fieldEquals('Order', orderId.toHexString(), 'status', 'CREATED');
        assert.fieldEquals('Order', orderId.toHexString(), 'isLocalOrder', 'false');
        assert.fieldEquals('Order', orderId.toHexString(), 'amountInReleased', '0');
        assert.fieldEquals('Order', orderId.toHexString(), 'amountInRefunded', '0');
        assert.fieldEquals('Order', orderId.toHexString(), 'amountOutFilled', '0');
    });

    test('getOrCreateOrder returns existing order', () => {
        const orderId = Bytes.fromHexString('0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef');

        // Create first order
        const order1 = getOrCreateOrder(orderId, 1, 8453);
        order1.status = 'COMPLETED';
        order1.save();

        // Load same order
        const order2 = getOrCreateOrder(orderId, 1, 8453);

        assert.stringEquals(order2.status, 'COMPLETED');
    });

    test('getOrCreateOrder detects local orders', () => {
        const orderId = Bytes.fromHexString('0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef');

        const order = getOrCreateOrder(orderId, 1, 1); // Same chain
        order.save();

        assert.fieldEquals('Order', orderId.toHexString(), 'isLocalOrder', 'true');
    });

    test('getOrCreateSolver creates new solver with correct defaults', () => {
        const solverAddress = Bytes.fromHexString('0x0000000000000000000000000000000000000001');

        const solver = getOrCreateSolver(solverAddress);
        solver.save();

        assert.entityCount('Solver', 1);
        assert.fieldEquals('Solver', solverAddress.toHexString(), 'totalFills', '0');
        assert.fieldEquals('Solver', solverAddress.toHexString(), 'totalVolumeOut', '0');
        assert.fieldEquals('Solver', solverAddress.toHexString(), 'totalVolumeIn', '0');
    });

    test('getOrCreateSolver returns existing solver', () => {
        const solverAddress = Bytes.fromHexString('0x0000000000000000000000000000000000000001');

        // Create first solver
        const solver1 = getOrCreateSolver(solverAddress);
        solver1.totalFills = 5;
        solver1.save();

        // Load same solver
        const solver2 = getOrCreateSolver(solverAddress);

        assert.i32Equals(solver2.totalFills, 5);
    });

    test('getOrCreateToken creates new token with correct defaults', () => {
        const tokenAddress = Bytes.fromHexString('0x0000000000000000000000000000000000000001');

        const token = getOrCreateToken(tokenAddress);
        token.save();

        assert.entityCount('Token', 1);
        assert.fieldEquals('Token', tokenAddress.toHexString(), 'totalVolumeIn', '0');
        assert.fieldEquals('Token', tokenAddress.toHexString(), 'totalVolumeOut', '0');
        assert.fieldEquals('Token', tokenAddress.toHexString(), 'netFlow', '0');
        assert.fieldEquals('Token', tokenAddress.toHexString(), 'orderCountAsInput', '0');
        assert.fieldEquals('Token', tokenAddress.toHexString(), 'orderCountAsOutput', '0');
    });

    test('getOrCreateChainRoute creates new route with correct defaults', () => {
        const originChainId = 1;
        const destChainId = 8453;
        const routeId = '1-8453';

        const route = getOrCreateChainRoute(originChainId, destChainId);
        route.save();

        assert.entityCount('ChainRoute', 1);
        assert.fieldEquals('ChainRoute', routeId, 'originChainId', '1');
        assert.fieldEquals('ChainRoute', routeId, 'destChainId', '8453');
        assert.fieldEquals('ChainRoute', routeId, 'totalOrders', '0');
        assert.fieldEquals('ChainRoute', routeId, 'totalVolumeIn', '0');
        assert.fieldEquals('ChainRoute', routeId, 'totalVolumeOut', '0');
    });

    test('getOrCreateChainRoute returns existing route', () => {
        const originChainId = 1;
        const destChainId = 8453;
        const routeId = '1-8453';

        // Create first route
        const route1 = getOrCreateChainRoute(originChainId, destChainId);
        route1.totalOrders = 10;
        route1.save();

        // Load same route
        const route2 = getOrCreateChainRoute(originChainId, destChainId);

        assert.i32Equals(route2.totalOrders, 10);
    });
});
