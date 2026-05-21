import { Bytes } from '@graphprotocol/graph-ts';
import { Token } from '../../generated/schema';
import { ZERO } from '../utils';

export function getOrCreateToken(tokenId: Bytes): Token {
    let token = Token.load(tokenId);

    if (token) return token;

    token = new Token(tokenId);
    token.totalVolumeIn = ZERO;
    token.totalVolumeOut = ZERO;
    token.netFlow = ZERO;
    token.orderCountAsInput = 0;
    token.orderCountAsOutput = 0;

    return token;
}
