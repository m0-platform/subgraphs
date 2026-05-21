import { ChainRoute } from '../../generated/schema';
import { ZERO, createChainRouteId } from '../utils';

export function getOrCreateChainRoute(originChainId: i32, destChainId: i32): ChainRoute {
    const id = createChainRouteId(originChainId, destChainId);
    let route = ChainRoute.load(id);

    if (route) return route;

    route = new ChainRoute(id);
    route.originChainId = originChainId;
    route.destChainId = destChainId;
    route.totalOrders = 0;
    route.totalVolumeIn = ZERO;
    route.totalVolumeOut = ZERO;

    return route;
}
