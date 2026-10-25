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

/** The last pass and balance seen for each saved account, by lower-cased email, with when they were seen. */
const known = new Map<string, { snapshot: AccountSnapshot, seenAt: number }>;

/** Keep an account's pass and balance from a request the app made anyway (the menu's check, or leaving the account). */
export function rememberSnapshot(email: string, snapshot: AccountSnapshot, seenAt = Date.now()) {
	known.set(email.trim().toLowerCase(), { snapshot, seenAt });
}

/** Forget an account's pass and balance (when it's removed), or every account's without an email. */
export function forgetSnapshot(email?: string) {
	if (email === undefined) known.clear();
	else known.delete(email.trim().toLowerCase());
}

/** The account's last known pass and balance, if seen within `maxAgeMs`. */
export function knownSnapshot(email: string, maxAgeMs = Infinity, now = Date.now()): AccountSnapshot | null {
	const entry = known.get(email.trim().toLowerCase());
	return entry && now - entry.seenAt <= maxAgeMs ? entry.snapshot : null;
}

export async function accountSnapshotFor(session: VaimooSession): Promise<AccountSnapshot> {
	const [credit, usage] = await Promise.all([getVaimooRemainingCredit(session), getVaimooSubscriptionUsage(session)]);
	return snapshotFrom(credit.remainingCredit, usage);
}