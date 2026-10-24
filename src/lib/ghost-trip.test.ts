import { afterEach, describe, expect, it, vi } from 'vitest';
import { GHOST_TRIP_AFTER_MS, ghostTripReset, ghostTripSignal, ghostTripStillOpen, setGhostTripHandler } from './ghost-trip';

describe('ghost trip detection', () => {
	afterEach(() => {
		ghostTripReset();
		setGhostTripHandler(null);
	});

	it('offers once the trip outlives the docked signal, and only once', () => {
		const handler = vi.fn(() => true);
		setGhostTripHandler(handler);
		ghostTripSignal('123', 0);
		ghostTripStillOpen('123', GHOST_TRIP_AFTER_MS - 1);
		expect(handler).not.toHaveBeenCalled();
		ghostTripStillOpen('123', GHOST_TRIP_AFTER_MS);
		ghostTripStillOpen('123', GHOST_TRIP_AFTER_MS + 15_000);
		expect(handler).toHaveBeenCalledOnce();
	});

	it('times from the first signal of the trip', () => {
		const handler = vi.fn(() => true);
		setGhostTripHandler(handler);
		ghostTripSignal('123', 0);
		ghostTripSignal('123', 60_000);
		ghostTripStillOpen('123', GHOST_TRIP_AFTER_MS);
		expect(handler).toHaveBeenCalledOnce();
	});

	it('ignores polls without a signal or for another trip', () => {
		const handler = vi.fn(() => true);
		setGhostTripHandler(handler);
		ghostTripStillOpen('123', GHOST_TRIP_AFTER_MS);
		ghostTripSignal('123', 0);
		ghostTripStillOpen('456', GHOST_TRIP_AFTER_MS);
		expect(handler).not.toHaveBeenCalled();
	});

	it('tries again on the next poll when there was nothing to offer', () => {
		const handler = vi.fn().mockReturnValueOnce(false).mockReturnValue(true);
		setGhostTripHandler(handler);
		ghostTripSignal('123', 0);
		ghostTripStillOpen('123', GHOST_TRIP_AFTER_MS);
		ghostTripStillOpen('123', GHOST_TRIP_AFTER_MS + 15_000);
		ghostTripStillOpen('123', GHOST_TRIP_AFTER_MS + 30_000);
		expect(handler).toHaveBeenCalledTimes(2);
	});

	it('starts over after a reset, e.g. on coming back to the account', () => {
		const handler = vi.fn(() => true);
		setGhostTripHandler(handler);
		ghostTripSignal('123', 0);
		ghostTripStillOpen('123', GHOST_TRIP_AFTER_MS);
		ghostTripReset();
		ghostTripSignal('123', GHOST_TRIP_AFTER_MS + 60_000);
		ghostTripStillOpen('123', GHOST_TRIP_AFTER_MS + 60_000 + GHOST_TRIP_AFTER_MS - 1);
		expect(handler).toHaveBeenCalledOnce();
		ghostTripStillOpen('123', GHOST_TRIP_AFTER_MS + 60_000 + GHOST_TRIP_AFTER_MS);
		expect(handler).toHaveBeenCalledTimes(2);
	});
});