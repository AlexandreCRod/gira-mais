// Gira+ Multi: "trip running" and pass labels for the saved accounts. The active account's come from what the app
// already loaded; each other account is asked by VAIMOO only when a list of accounts is shown, and at most once every
// LABEL_MAX_AGE_MS, with the same requests Gira+ makes for the active account (session refresh, trip, pass, balance).
import { isUsageExpired, rememberSnapshot, snapshotFrom } from '$lib/account-snapshot';
import { otherAccounts, rememberSession, sameEmail, signIn, switchingTo } from '$lib/accounts';
import { getCurrentVaimooTrip, getVaimooRemainingCredit, getVaimooSubscriptionUsage } from '$lib/vaimoo-api/client';
import type { VaimooCurrentTrip, VaimooSubscriptionUsage } from '$lib/vaimoo-api/types';
import { get, writable } from 'svelte/store';

export const LABEL_MAX_AGE_MS = 3 * 60_000;

export type PassState = 'valid' | 'expired' | 'none';
export type AccountLabels = { tripRunning: boolean, pass: PassState, balance: number, checkedAt: number };

/** The last check of each other account, by lower-cased email. */
export const checkedLabels = writable<Record<string, AccountLabels>>({});

export const labelKey = (email: string) => email.trim().toLowerCase();

/** Same rule as upstream's getActiveTrip. */
export const hasRunningTrip = (trip: VaimooCurrentTrip) => trip.activeTripId != null && trip.activeTripId > 0;

/**
 * The account can't start a trip: no valid pass, or a negative balance (which turns Gira+'s profile button orange).
 * Anything not known yet counts as fine.
 */
export const blockedForTrip = (pass: PassState | null, balance: number | null) => (pass !== null && pass !== 'valid') || (balance !== null && balance < 0);

/** Same rule as upstream's getAccountSnapshot: a pass counts while any of its usages hasn't expired. */
export function passState(usage: VaimooSubscriptionUsage[], now = Date.now()): PassState {
	if (!usage.length) return 'none';
	return usage.some(item => !isUsageExpired(item, now)) ? 'valid' : 'expired';
}

let running: Promise<void> | null = null;

/** Check the other accounts whose labels are older than LABEL_MAX_AGE_MS. A failed check keeps the previous labels. */
export function refreshAccountLabels(): Promise<void> {
	running ??= checkDue().finally(() => running = null);
	return running;
}

async function checkDue() {
	const checked = get(checkedLabels);
	const due = otherAccounts().filter(account => Date.now() - (checked[labelKey(account.email)]?.checkedAt ?? -Infinity) >= LABEL_MAX_AGE_MS);
	await Promise.all(due.map(async account => {
		const switching = get(switchingTo);
		if (switching && sameEmail(switching, account.email)) return;
		try {
			const session = await signIn(account);
			rememberSession(account.email, session);
			const [trip, usage, credit] = await Promise.all([getCurrentVaimooTrip(session), getVaimooSubscriptionUsage(session), getVaimooRemainingCredit(session)]);
			const labels = { tripRunning: hasRunningTrip(trip), pass: passState(usage), balance: credit.remainingCredit, checkedAt: Date.now() };
			// The same answers make the profile's switch to this account quicker
			rememberSnapshot(account.email, snapshotFrom(credit.remainingCredit, usage));
			checkedLabels.update(all => ({ ...all, [labelKey(account.email)]: labels }));
		} catch (error) {
			console.debug('Could not check a saved account', error);
		}
	}));
}