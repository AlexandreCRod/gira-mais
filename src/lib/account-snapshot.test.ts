import { describe, expect, it } from 'vitest';
import type { VaimooSubscriptionUsage } from '$lib/vaimoo-api/types';
import { snapshotFrom } from './account-snapshot';

const NOW = Date.parse('2026-10-24T12:00:00Z');

function usage(name: string, expirationDate: string, isExpired?: boolean) {
	return { expirationDate, isExpired, currentSubscription: { name, membershipType: 'yearly' } } as unknown as VaimooSubscriptionUsage;
}

describe('snapshotFrom', () => {
	it('has no pass without usages', () => {
		expect(snapshotFrom(2, [], NOW)).toEqual({ balance: 2, subscription: null });
	});

	it('shows the pass that is still valid', () => {
		const snapshot = snapshotFrom(0, [usage('Old', '2026-01-01T00:00:00Z'), usage('Passe Anual', '2027-01-01T00:00:00Z')], NOW);
		expect(snapshot.subscription).toEqual({
			active: true,
			expiresAt: new Date('2027-01-01T00:00:00Z'),
			name: 'Passe Anual',
			status: 'Active',
			type: 'yearly',
		});
	});

	it('shows the first pass as expired when none is valid, trusting VAIMOO\'s own flag over the date', () => {
		const snapshot = snapshotFrom(-1, [usage('Passe Anual', '2027-01-01T00:00:00Z', true)], NOW);
		expect(snapshot.subscription).toMatchObject({ active: false, status: 'Expired', name: 'Passe Anual' });
	});
});