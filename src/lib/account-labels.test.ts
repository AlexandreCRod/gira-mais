import { get, writable } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	others: [] as { email: string }[],
	signIn: vi.fn(),
	rememberSession: vi.fn(),
	getCurrentVaimooTrip: vi.fn(),
	getVaimooSubscriptionUsage: vi.fn(),
	getVaimooRemainingCredit: vi.fn(),
}));
vi.mock('$lib/accounts', () => ({
	otherAccounts: () => mocks.others,
	rememberSession: mocks.rememberSession,
	sameEmail: (a: string, b: string) => a.toLowerCase() === b.toLowerCase(),
	signIn: mocks.signIn,
	switchingTo: writable(null),
}));
vi.mock('$lib/vaimoo-api/client', () => ({
	getCurrentVaimooTrip: mocks.getCurrentVaimooTrip,
	getVaimooSubscriptionUsage: mocks.getVaimooSubscriptionUsage,
	getVaimooRemainingCredit: mocks.getVaimooRemainingCredit,
}));

import { blockedForTrip, checkedLabels, LABEL_MAX_AGE_MS, passState, refreshAccountLabels } from './account-labels';

const usage = (expirationDate: string, isExpired?: boolean) => ({ currentSubscription: { name: 'Anual' }, expirationDate, isExpired });

describe('passState', () => {
	const now = Date.parse('2026-10-24T12:00:00Z');

	it('follows upstream\'s rule: valid while any pass hasn\'t expired', () => {
		expect(passState([usage('2026-01-01T00:00:00Z'), usage('2027-01-01T00:00:00Z')], now)).toBe('valid');
		expect(passState([usage('2026-01-01T00:00:00Z')], now)).toBe('expired');
		expect(passState([usage('2027-01-01T00:00:00Z', true)], now)).toBe('expired');
		expect(passState([], now)).toBe('none');
	});
});

describe('blockedForTrip', () => {
	it('flags a pass that is not valid or a negative balance, and nothing unknown', () => {
		expect(blockedForTrip('valid', 0)).toBe(false);
		expect(blockedForTrip('valid', -0.5)).toBe(true);
		expect(blockedForTrip('expired', 3)).toBe(true);
		expect(blockedForTrip('none', null)).toBe(true);
		expect(blockedForTrip(null, null)).toBe(false);
	});
});

describe('refreshAccountLabels', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(Date.parse('2026-10-24T12:00:00Z'));
		vi.clearAllMocks();
		checkedLabels.set({});
		mocks.others = [{ email: 'bob@example.com' }];
		mocks.signIn.mockResolvedValue({ userId: 2, refreshToken: 'bob-new' });
		mocks.getCurrentVaimooTrip.mockResolvedValue({ activeTripId: 7 });
		mocks.getVaimooSubscriptionUsage.mockResolvedValue([usage('2026-01-01T00:00:00Z')]);
		mocks.getVaimooRemainingCredit.mockResolvedValue({ remainingCredit: -1.2 });
	});
	afterEach(() => vi.useRealTimers());

	it('checks the other accounts and keeps their rotated sessions', async () => {
		await refreshAccountLabels();
		expect(get(checkedLabels)['bob@example.com']).toMatchObject({ tripRunning: true, pass: 'expired', balance: -1.2 });
		expect(mocks.rememberSession).toHaveBeenCalledWith('bob@example.com', { userId: 2, refreshToken: 'bob-new' });
	});

	it('asks VAIMOO at most once every three minutes per account', async () => {
		await refreshAccountLabels();
		vi.advanceTimersByTime(LABEL_MAX_AGE_MS - 1);
		await refreshAccountLabels();
		expect(mocks.signIn).toHaveBeenCalledOnce();
		vi.advanceTimersByTime(1);
		await refreshAccountLabels();
		expect(mocks.signIn).toHaveBeenCalledTimes(2);
	});

	it('keeps the previous labels when a check fails', async () => {
		await refreshAccountLabels();
		vi.advanceTimersByTime(LABEL_MAX_AGE_MS);
		mocks.getCurrentVaimooTrip.mockRejectedValue(new Error('offline'));
		await refreshAccountLabels();
		expect(get(checkedLabels)['bob@example.com']).toMatchObject({ tripRunning: true, pass: 'expired' });
	});
});