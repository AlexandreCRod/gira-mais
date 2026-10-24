import { afterEach, describe, expect, it, vi } from 'vitest';
import { VaimooApiError } from '$lib/vaimoo-api/client';
import { isActiveTripRefusal, offerOtherAccounts, setActiveTripRefusalHandler } from './unlock-fallback';

describe('isActiveTripRefusal', () => {
	it('recognises VAIMOO\'s active trip error code', () => {
		expect(isActiveTripRefusal(new VaimooApiError('refused', 400, { responseStatus: { errorCode: 1607 } }))).toBe(true);
	});

	it('recognises the legacy active trip error keys', () => {
		expect(isActiveTripRefusal(new VaimooApiError('refused', 400, { errors: ['already_active_trip'] }))).toBe(true);
		expect(isActiveTripRefusal(new VaimooApiError('refused', 400, { errors: ['already_has_active_trip'] }))).toBe(true);
	});

	it('ignores other refusals and errors', () => {
		expect(isActiveTripRefusal(new VaimooApiError('refused', 400, { responseStatus: { errorCode: 1122 } }))).toBe(false);
		expect(isActiveTripRefusal(new Error('already_active_trip'))).toBe(false);
	});
});

describe('offerOtherAccounts', () => {
	afterEach(() => setActiveTripRefusalHandler(null));

	it('offers nothing without a handler', () => {
		expect(offerOtherAccounts(async () => true)).toBe(false);
	});

	it('passes the retry to the handler', () => {
		const handler = vi.fn(() => true);
		const retry = async () => true;
		setActiveTripRefusalHandler(handler);
		expect(offerOtherAccounts(retry)).toBe(true);
		expect(handler).toHaveBeenCalledWith(retry);
	});
});