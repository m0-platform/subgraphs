import { assert, describe, test, beforeEach, clearStore, dataSourceMock } from 'matchstick-as';
import { Address, BigInt, Bytes, DataSourceContext } from '@graphprotocol/graph-ts';
import { Order, Token, ChainRoute } from '../generated/schema';
import { getOrCreateOrder } from '../src/entities/order';
import { getOrCreateToken } from '../src/entities/token';
import { getOrCreateChainRoute } from '../src/entities/chain-route';
import { bytes32ToAddress, isZeroBytes32, ZERO } from '../src/utils';

const MOCK_ADDRESS = Address.fromString('0x0000000000000000000000000000000000000001');
const MOCK_ADDRESS_2 = Address.fromString('0x0000000000000000000000000000000000000002');
const MOCK_BYTES32 = Bytes.fromHexString('0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef');
const MOCK_BYTES32_2 = Bytes.fromHexString('0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890');
const MOCK_ZERO_BYTES32 = Bytes.fromHexString(
    '0x0000000000000000000000000000000000000000000000000000000000000000'
);

describe('OrderOpened Logic', () => {
    beforeEach(() => {
        clearStore();
    });

    test('creates Order with correct fields', () => {
        const orderId = MOCK_BYTES32;
        const sender = MOCK_ADDRESS;
        const tokenIn = MOCK_ADDRESS_2;
        const amountIn = BigInt.fromI32(1000);
        const destChainId = 8453;
        const tokenOut = MOCK_BYTES32_2;
        const amountOut = BigInt.fromI32(990);
        const originChainId = 1;

        const order = getOrCreateOrder(orderId, originChainId, destChainId);
        order.sender = sender;
        order.tokenIn = tokenIn;
        order.tokenOut = bytes32ToAddress(tokenOut);
        order.amountIn = amountIn;
        order.amountOut = amountOut;
        order.createdAt = BigInt.fromI32(1000000);
        order.status = 'CREATED';
        order.save();

        assert.entityCount('Order', 1);
        assert.fieldEquals('Order', orderId.toHexString(), 'status', 'CREATED');
        assert.fieldEquals('Order', orderId.toHexString(), 'sender', sender.toHexString());
        assert.fieldEquals('Order', orderId.toHexString(), 'destChainId', destChainId.toString());
        assert.fieldEquals('Order', orderId.toHexString(), 'amountIn', amountIn.toString());
        assert.fieldEquals('Order', orderId.toHexString(), 'amountOut', amountOut.toString());
    });

    test('updates Token stats for input token', () => {
        const tokenIn = MOCK_ADDRESS_2;
        const amountIn = BigInt.fromI32(1000);

        const tokenInEntity = getOrCreateToken(tokenIn);
        tokenInEntity.orderCountAsInput = tokenInEntity.orderCountAsInput + 1;
        tokenInEntity.totalVolumeIn = tokenInEntity.totalVolumeIn.plus(amountIn);
        tokenInEntity.netFlow = tokenInEntity.totalVolumeIn.minus(tokenInEntity.totalVolumeOut);
        tokenInEntity.save();

        assert.fieldEquals('Token', tokenIn.toHexString(), 'orderCountAsInput', '1');
        assert.fieldEquals('Token', tokenIn.toHexString(), 'totalVolumeIn', amountIn.toString());
        assert.fieldEquals('Token', tokenIn.toHexString(), 'netFlow', amountIn.toString());
    });

    test('updates Token stats for output token', () => {
        const tokenOut = MOCK_BYTES32_2;
        const tokenOutAddress = bytes32ToAddress(tokenOut);
        const amountOut = BigInt.fromI32(990);

        const tokenOutEntity = getOrCreateToken(tokenOutAddress);
        tokenOutEntity.orderCountAsOutput = tokenOutEntity.orderCountAsOutput + 1;
        tokenOutEntity.totalVolumeOut = tokenOutEntity.totalVolumeOut.plus(amountOut);
        tokenOutEntity.netFlow = tokenOutEntity.totalVolumeIn.minus(tokenOutEntity.totalVolumeOut);
        tokenOutEntity.save();

        assert.fieldEquals('Token', tokenOutAddress.toHexString(), 'orderCountAsOutput', '1');
        assert.fieldEquals('Token', tokenOutAddress.toHexString(), 'totalVolumeOut', amountOut.toString());
    });

    test('creates ChainRoute with correct stats', () => {
        const originChainId = 1;
        const destChainId = 8453;
        const amountIn = BigInt.fromI32(1000);
        const amountOut = BigInt.fromI32(990);

        const route = getOrCreateChainRoute(originChainId, destChainId);
        route.totalOrders = route.totalOrders + 1;
        route.totalVolumeIn = route.totalVolumeIn.plus(amountIn);
        route.totalVolumeOut = route.totalVolumeOut.plus(amountOut);
        route.save();

        const routeId = '1-8453';
        assert.entityCount('ChainRoute', 1);
        assert.fieldEquals('ChainRoute', routeId, 'totalOrders', '1');
        assert.fieldEquals('ChainRoute', routeId, 'totalVolumeIn', amountIn.toString());
        assert.fieldEquals('ChainRoute', routeId, 'totalVolumeOut', amountOut.toString());
    });

    test('isLocalOrder is true for same-chain orders', () => {
        const orderId = MOCK_BYTES32;
        const originChainId = 1;
        const destChainId = 1; // Same as origin

        const order = getOrCreateOrder(orderId, originChainId, destChainId);
        order.save();

        assert.fieldEquals('Order', orderId.toHexString(), 'isLocalOrder', 'true');
    });

    test('isLocalOrder is false for cross-chain orders', () => {
        const orderId = MOCK_BYTES32;
        const originChainId = 1;
        const destChainId = 8453; // Different

        const order = getOrCreateOrder(orderId, originChainId, destChainId);
        order.save();

        assert.fieldEquals('Order', orderId.toHexString(), 'isLocalOrder', 'false');
    });

    test('designated solver is set when non-zero bytes32', () => {
        const orderId = MOCK_BYTES32;
        const solver = Bytes.fromHexString('0x000000000000000000000000' + MOCK_ADDRESS.toHexString().slice(2));

        const order = getOrCreateOrder(orderId, 1, 8453);

        if (!isZeroBytes32(solver)) {
            order.solver = bytes32ToAddress(solver);
        }
        order.save();

        assert.fieldEquals('Order', orderId.toHexString(), 'solver', MOCK_ADDRESS.toHexString());
    });

    test('designated solver is null when zero bytes32', () => {
        const orderId = MOCK_BYTES32;
        const solver = MOCK_ZERO_BYTES32;

        const order = getOrCreateOrder(orderId, 1, 8453);

        if (!isZeroBytes32(solver)) {
            order.solver = bytes32ToAddress(solver);
        }
        order.save();

        assert.fieldEquals('Order', orderId.toHexString(), 'solver', 'null');
    });
});
