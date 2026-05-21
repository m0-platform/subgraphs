import { DestinationSupportUpdated as DestinationSupportUpdatedEvent } from '../../generated/OrderBook/OrderBook';
import { DestinationSupport } from '../../generated/schema';

export function handleDestinationSupportUpdated(event: DestinationSupportUpdatedEvent): void {
    const destChainId = event.params.destChainId.toI32();
    const isSupported = event.params.isSupported;

    const id = destChainId.toString();
    let support = DestinationSupport.load(id);

    if (support === null) {
        support = new DestinationSupport(id);
        support.destChainId = destChainId;
    }

    support.isSupported = isSupported;
    support.updatedAt = event.block.timestamp;
    support.save();
}
