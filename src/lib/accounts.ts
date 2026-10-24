// Gira+ Multi: several saved accounts and switching between them. The active account still lives in
// $lib/account exactly as upstream keeps it (one token, one set of credentials); this module keeps the
// others next to it and swaps them in, so upstream's login and token refresh code stays untouched.
import { accountInfo, logOut, refreshAccountInfo, token, updateUserInfo, user, userCredentials } from '$lib/account';
import { reportApiError } from '$lib/error-reporting';
import { stopBackendSync } from '$lib/gira-api/backend-sync';
import { currentTrip, DEBUG_TRIP_CODE, tripRating } from '$lib/trip';
import { setActiveTripRefusalHandler } from '$lib/unlock-fallback';
import { InvalidCredentialsError, loginWithEmel, refreshVaimooSession } from '$lib/vaimoo-api/client';
import type { VaimooSession } from '$lib/vaimoo-api/types';
import { Preferences } from '@capacitor/preferences';
import { get, writable } from 'svelte/store';

export type SavedAccount = {
	email: string;
	password: string;
	/** The account's display name; the email until the account has been loaded once. */
	name: string;
	/** VAIMOO's user id, so a late token refresh for another account can't overwrite this one's session. */
	userId: number | null;
	/** The latest refresh token, so switching back can skip the full EMEL login while it's still valid. */
	refreshToken: string | null;
};

export type SwitchResult = 'ok' | 'invalid-credentials' | 'failed';

export type AccountPickerRequest = {
	reason: 'switch' | 'active-trip';
	/** Run after a successful switch, e.g. the unlock that the previous account was refused. */
	retry?: () => Promise<boolean>;
};

const STORAGE_KEY = 'multi/accounts';

export const savedAccounts = writable<SavedAccount[]>([]);
/** The email being switched to, while a switch is in progress. */
export const switchingTo = writable<string | null>(null);
/** Asks AccountPickerHost to show the account picker. */
export const accountPicker = writable<AccountPickerRequest | null>(null);

export const sameEmail = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export function activeEmail() {
	return get(userCredentials)?.email ?? null;
}

export function otherAccounts(accounts = get(savedAccounts), active = activeEmail()) {
	return accounts.filter(account => !active || !sameEmail(account.email, active));
}

/** Whether a real trip is showing, which switching would stop tracking in this app. */
export function tripInProgress() {
	const trip = get(currentTrip);
	return trip !== null && trip.code !== DEBUG_TRIP_CODE && !trip.finished;
}

function parse(value: string | null): SavedAccount[] {
	try {
		const parsed: unknown = JSON.parse(value ?? '[]');
		if (!Array.isArray(parsed)) return [];
		return parsed
			.filter(account => typeof account?.email === 'string' && typeof account?.password === 'string')
			.map(account => ({
				email: account.email,
				password: account.password,
				name: typeof account.name === 'string' && account.name ? account.name : account.email,
				userId: typeof account.userId === 'number' ? account.userId : null,
				refreshToken: typeof account.refreshToken === 'string' ? account.refreshToken : null,
			}));
	} catch {
		return [];
	}
}

/** Add an account (only with its password) or update the saved one with the same email. */
function upsert(changes: Partial<SavedAccount> & { email: string }) {
	savedAccounts.update(accounts => {
		const index = accounts.findIndex(account => sameEmail(account.email, changes.email));
		if (index === -1) {
			if (changes.password == null) return accounts;
			return [...accounts, { name: changes.email, userId: null, refreshToken: null, password: changes.password, ...changes }];
		}
		const current = accounts[index];
		const merged = { ...current, ...changes, email: current.email };
		if (JSON.stringify(merged) === JSON.stringify(current)) return accounts;
		return accounts.map((account, i) => i === index ? merged : account);
	});
}

function displayName(session: VaimooSession, email: string) {
	return [session.user.firstName, session.user.lastName].filter(Boolean).join(' ') || session.user.userName || email;
}

let started: Promise<() => void> | null = null;

/**
 * Load the saved accounts and start tracking the active one; upstream's single saved account is picked up
 * on its next login. Resolves to a function that stops the tracking.
 */
export function initAccounts() {
	started ??= start();
	return started;
}

async function start() {
	const { value } = await Preferences.get({ key: STORAGE_KEY });
	savedAccounts.set(parse(value));

	// Skip only the initial call, which hands back what was just loaded
	let loaded = false;
	const stopSaving = savedAccounts.subscribe(accounts => {
		if (loaded) void Preferences.set({ key: STORAGE_KEY, value: JSON.stringify(accounts) });
	});
	loaded = true;

	// Keep the active account's entry current: added on its first successful login, then its rotating
	// refresh token and its name tracked as they change. The stores change one at a time during a login or
	// a switch, so only matching pieces are taken.
	const trackActive = () => {
		const credentials = get(userCredentials);
		const current = get(token);
		if (!credentials || !current) return;
		const saved = get(savedAccounts).find(account => sameEmail(account.email, credentials.email));
		if (saved?.userId != null && saved.userId !== current.userId) return;
		const profile = get(user);
		upsert({
			email: credentials.email,
			password: credentials.password,
			userId: current.userId,
			refreshToken: current.refreshToken,
			...profile?.name && sameEmail(profile.email, credentials.email) ? { name: profile.name } : {},
		});
	};
	const unsubscribers = [stopSaving, userCredentials.subscribe(trackActive), token.subscribe(trackActive), user.subscribe(trackActive)];

	setActiveTripRefusalHandler(retry => {
		if (!otherAccounts().length) return false;
		accountPicker.set({ reason: 'active-trip', retry });
		return true;
	});

	return () => {
		unsubscribers.forEach(unsubscribe => unsubscribe());
		setActiveTripRefusalHandler(null);
		started = null;
	};
}

/** A session for the account: its saved refresh token while that's still valid, otherwise a full login. */
async function signIn(account: SavedAccount): Promise<VaimooSession> {
	if (account.refreshToken) {
		try {
			return await refreshVaimooSession(account.refreshToken);
		} catch (error) {
			console.debug('Saved session no longer valid, logging in again', error);
		}
	}
	return loginWithEmel(account.email, account.password);
}

/** Make the account active, the way logging out and back in would but without the login screen in between. */
function activate(account: SavedAccount, session: VaimooSession) {
	stopBackendSync();
	currentTrip.set(null);
	tripRating.set({ currentRating: null });
	accountInfo.set(null);
	userCredentials.set({ email: account.email, password: account.password });
	// Setting the token restarts the backend sync, which loads this account's active trip
	token.set({
		accessToken: session.accessToken,
		refreshToken: session.refreshToken,
		expiration: session.expiresAt,
		userId: session.userId,
		tenantId: session.user.tenantId,
	});
	user.set({ email: session.user.email ?? account.email, name: displayName(session, account.email) });
	void refreshAccountInfo().catch(error => {
		console.error('Failed to load VAIMOO account data', error);
		void reportApiError('account_info_error', error, { source: 'account-switch' });
	});
	void updateUserInfo().catch(error => {
		console.error('Failed to load VAIMOO user data', error);
		void reportApiError('user_info_error', error, { source: 'account-switch' });
	});
}

/** Switch to a saved account. Nothing changes unless the new account's session is ready. */
export async function switchAccount(email: string): Promise<SwitchResult> {
	const target = get(savedAccounts).find(account => sameEmail(account.email, email));
	if (!target || get(switchingTo)) return 'failed';
	switchingTo.set(target.email);
	try {
		let session: VaimooSession;
		try {
			session = await signIn(target);
		} catch (error) {
			if (error instanceof InvalidCredentialsError) return 'invalid-credentials';
			void reportApiError('account_switch_error', error);
			return 'failed';
		}
		upsert({ email: target.email, userId: session.userId, refreshToken: session.refreshToken });
		activate(target, session);
		return 'ok';
	} finally {
		switchingTo.set(null);
	}
}

/** Log in to an account and make it the active one: 0 on success, 100 for wrong credentials, like login(). Throws on network trouble. */
export async function addAccount(email: string, password: string): Promise<number> {
	let session: VaimooSession;
	try {
		session = await loginWithEmel(email, password);
	} catch (error) {
		if (error instanceof InvalidCredentialsError) return 100;
		void reportApiError('login_error', error, { source: 'add-account' });
		throw error;
	}
	upsert({ email, password, userId: session.userId, refreshToken: session.refreshToken });
	const account = get(savedAccounts).find(saved => sameEmail(saved.email, email));
	if (account) activate(account, session);
	return 0;
}

/**
 * Remove an account from this phone. Removing the active one switches to another saved account first;
 * if that switch fails nothing is removed, and with no other account left it logs out as upstream does.
 */
export async function removeAccount(email: string): Promise<SwitchResult> {
	const active = activeEmail();
	if (active && sameEmail(active, email)) {
		const next = otherAccounts()[0];
		if (next) {
			const result = await switchAccount(next.email);
			if (result !== 'ok') return result;
		} else {
			await logOut();
		}
	}
	savedAccounts.update(accounts => accounts.filter(account => !sameEmail(account.email, email)));
	return 'ok';
}

/** The profile page's exit button: remove the active account, moving on to the next saved one if there is one. */
export async function signOutActive(): Promise<SwitchResult> {
	const active = activeEmail();
	if (!active) {
		await logOut();
		return 'ok';
	}
	return removeAccount(active);
}