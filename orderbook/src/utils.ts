import { BigInt, Bytes, ethereum } from '@graphprotocol/graph-ts';

// Timeseries entities' id is set automatically by subgraph
// @see https://thegraph.com/docs/en/subgraphs/best-practices/timeseries/
export const TIMESERIES_ID = 1;

export const ZERO = BigInt.fromI32(0);
export const ONE = BigInt.fromI32(1);
export const ZERO_BYTES = Bytes.fromHexString('0x0000000000000000000000000000000000000000000000000000000000000000');
export const ZERO_ADDRESS = Bytes.fromHexString('0x0000000000000000000000000000000000000000');

/**
 * Creates a unique ID from transaction hash and log index
 */
export function createEventId(event: ethereum.Event): Bytes {
    return event.transaction.hash.concatI32(event.logIndex.toI32());
}

/**
 * Creates a chain route ID string from origin and destination chain IDs
 */
export function createChainRouteId(originChainId: i32, destChainId: i32): string {
    return originChainId.toString() + '-' + destChainId.toString();
}

/**
 * Timeseries entities' id and timestamp are automatically set by subgraph in microseconds. e.g., 1698412800000000
 * However, event.block.timestamp is in seconds.
 * This function converts seconds to microseconds to normalize the data.
 */
export function toMicroseconds(timestamp: BigInt): i64 {
    return timestamp.times(BigInt.fromI32(1000000)).toI64();
}

/**
 * Converts bytes32 to address (takes last 20 bytes)
 */
export function bytes32ToAddress(bytes32: Bytes): Bytes {
    // bytes32 is 32 bytes, address is 20 bytes (last 20 bytes of bytes32)
    const addressHex = bytes32.toHexString().slice(26); // 2 for '0x' + 24 for first 12 bytes = 26
    return Bytes.fromHexString('0x' + addressHex);
}

/**
 * Checks if a bytes32 value is all zeros
 */
export function isZeroBytes32(bytes32: Bytes): boolean {
    return bytes32.equals(ZERO_BYTES);
}
