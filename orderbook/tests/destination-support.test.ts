import { assert, describe, test, beforeEach, clearStore } from 'matchstick-as';
import { handleDestinationSupportUpdated } from '../src/handlers/destination-support';
import { createDestinationSupportUpdatedEvent } from './test-utils';

describe('DestinationSupportUpdated Handler', () => {
    beforeEach(() => {
        clearStore();
    });

    test('creates DestinationSupport entity when enabling support', () => {
        const destChainId = 8453; // Base
        const isSupported = true;

        const event = createDestinationSupportUpdatedEvent(destChainId, isSupported);

        handleDestinationSupportUpdated(event);

        const entityId = destChainId.toString();
        assert.entityCount('DestinationSupport', 1);
        assert.fieldEquals('DestinationSupport', entityId, 'destChainId', destChainId.toString());
        assert.fieldEquals('DestinationSupport', entityId, 'isSupported', 'true');
    });

    test('updates DestinationSupport when disabling support', () => {
        const destChainId = 8453;

        // First enable
        const enableEvent = createDestinationSupportUpdatedEvent(destChainId, true);
        handleDestinationSupportUpdated(enableEvent);

        // Then disable
        const disableEvent = createDestinationSupportUpdatedEvent(destChainId, false);
        handleDestinationSupportUpdated(disableEvent);

        const entityId = destChainId.toString();
        assert.entityCount('DestinationSupport', 1);
        assert.fieldEquals('DestinationSupport', entityId, 'isSupported', 'false');
    });

    test('tracks multiple destination chains', () => {
        const chains = [8453, 42161, 10]; // Base, Arbitrum, Optimism

        for (let i = 0; i < chains.length; i++) {
            const event = createDestinationSupportUpdatedEvent(chains[i], true);
            handleDestinationSupportUpdated(event);
        }

        assert.entityCount('DestinationSupport', 3);

        for (let i = 0; i < chains.length; i++) {
            assert.fieldEquals('DestinationSupport', chains[i].toString(), 'isSupported', 'true');
        }
    });
});
