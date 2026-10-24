// Gira+ Multi: upstream's account snapshot (balance and pass) for any session, not only the active one. Used to load a
// saved account's pass and balance before switching to it, so the profile changes all at once. The rules are copied
// from getAccountSnapshot in gira-api/api.ts, which only works with the active session; keep the two in step.
import type { AccountSnapshot } from '$lib/gira-api/models';
import { getVaimooRemainingCredit, getVaimooSubscriptionUsage } from '$lib/vaimoo-api/client';
import type { VaimooSession, VaimooSubscriptionUsage } from '$lib/vaimoo-api/types';

export const isUsageExpired = (item: VaimooSubscriptionUsage, now = Date.now()) => item.isExpired ?? new Date(item.expirationDate).getTime() <= now;

export function snapshotFrom(remainingCredit: number, usage: VaimooSubscriptionUsage[], now = Date.now()): AccountSnapshot {
	const activeUsage = usage.find(item => !isUsageExpired(item, now)) ?? usage[0];
	return {
		balance: remainingCredit,
		subscription: activeUsage ? {
			active: !isUsageExpired(activeUsage, now),
			expiresAt: new Date(activeUsage.expirationDate),
			name: activeUsage.currentSubscription.name,
			status: isUsageExpired(activeUsage, now) ? 'Expired' : 'Active',
			type: activeUsage.currentSubscription.membershipType ?? 'unknown',
		} : null,
	};
}

export async function accountSnapshotFor(session: VaimooSession): Promise<AccountSnapshot> {
	const [credit, usage] = await Promise.all([getVaimooRemainingCredit(session), getVaimooSubscriptionUsage(session)]);
	return snapshotFrom(credit.remainingCredit, usage);
}