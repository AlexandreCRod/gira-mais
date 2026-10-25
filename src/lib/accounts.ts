// Gira+ Multi: several saved accounts and switching between them. The active account still lives in
// $lib/account exactly as upstream keeps it (one token, one set of credentials); this module keeps the
// others next to it and swaps them in, so upstream's login and token refresh code stays untouched.
import { accountInfo, logOut, refreshAccountInfo, token, tokenRefreshInFlight, updateUserInfo, user, userCredentials } from '$lib/account';
import { accountSnapshotFor, forgetSnapshot, knownSnapshot, rememberSnapshot } from '$lib/account-snapshot';
import { reportApiError } from '$lib/error-reporting';
import { stopBackendSync } from '$lib/gira-api/backend-sync';
import type { AccountSnapshot } from '$lib/gira-api/models';
import { setGhostTripHandler, setTripDockedListener } from '$lib/ghost-trip';
import { currentTrip, DEBUG_TRIP_CODE, tripRating, tripStatusInFlight } from '$lib/trip';
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
	reason: 'switch' | 'active-trip' | 'ghost-trip';
	/** Run after a successful switch, e.g. the unlock that the previous account was refused. */
	retry?: () => Promise<boolean>;
};

const STORAGE_KEY = 'multi/accounts';
const MAIN_KEY = 'multi/mainAccount';
/** The account with a trip running whose bike hasn't been docked yet; the next start opens on it instead of the main one. */
const TRIP_ACCOUNT_KEY = 'multi/tripAccount';
/** How long a switch waits for a token refresh or trip check of the previous account that is already under way. */
const SETTLE_TIMEOUT_MS = 10_000;
const SNAPSHOT_WAIT_MS = 3_000;
/**
 * A pass and balance seen this recently (by the map menu's check, or when last leaving the account) are shown at
 * once instead of waiting for them; Gira+'s own refresh then brings them up to date, as after a login.
 */
export const SNAPSHOT_REUSE_MS = 3 * 60_000;

export const savedAccounts = writable<SavedAccount[]>([]);
/** The email of the account the app opens on; null keeps upstream's "the last one used". */
export const mainAccount = writable<string | null>(null);
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

function store(key: string, value: string | null) {
	return value ? Preferences.set({ key, value }) : Preferences.remove({ key });
}

let tripAccount: string | null = null;
function setTripAccount(email: string | null) {
	if (email === tripAccount) return;
	tripAccount = email;
	void store(TRIP_ACCOUNT_KEY, email);
}

/**
 * Runs before upstream's loadUserCreds at app start and points its saved login at the account to open on: the one
 * whose trip was still running, otherwise the main one. Upstream then logs in once, as it always does, just with
 * that account, so opening is no slower. Logged out stays logged out.
 */
export async function chooseStartupAccount() {
	try {
		const read = (key: string) => Preferences.get({ key }).then(result => result.value);
		const [stored, main, runningTripAccount, last] = await Promise.all([STORAGE_KEY, MAIN_KEY, TRIP_ACCOUNT_KEY, 'email'].map(read));
		// Used for this start only: if the trip is still running, following it again sets it back
		if (runningTripAccount) await Preferences.remove({ key: TRIP_ACCOUNT_KEY });
		const target = runningTripAccount ?? main;
		if (!last || !target || sameEmail(target, last)) return;
		const account = parse(stored).find(saved => sameEmail(saved.email, target));
		if (!account) return;
		await Promise.all([Preferences.set({ key: 'email', value: account.email }), Preferences.set({ key: 'password', value: account.password })]);
	} catch (error) {
		console.error('Choosing the account to open on failed', error);
	}
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
	const [stored, main] = await Promise.all([STORAGE_KEY, MAIN_KEY].map(key => Preferences.get({ key }).then(result => result.value)));
	savedAccounts.set(parse(stored));
	mainAccount.set(main || null);
	// chooseStartupAccount has used up the stored one; following a trip sets it again
	tripAccount = null;

	// Skip only the initial calls, which hand back what was just loaded
	let loaded = false;
	const stopSaving = savedAccounts.subscribe(accounts => {
		if (loaded) void Preferences.set({ key: STORAGE_KEY, value: JSON.stringify(accounts) });
	});
	const stopSavingMain = mainAccount.subscribe(email => {
		if (loaded) void store(MAIN_KEY, email);
	});
	loaded = true;

	// Remember the account whose trip is running until its bike is docked or the trip ends, so that a restart
	// mid-trip opens on it rather than on the main account. A switch also clears the trip, so it doesn't count.
	let dockedTrip: string | null = null;
	let followingTrip = false;
	const stopTripTracking = currentTrip.subscribe(trip => {
		const email = activeEmail();
		const running = trip !== null && trip.confirmed && Boolean(trip.code) && trip.code !== DEBUG_TRIP_CODE;
		if (running && email && trip.code !== dockedTrip) setTripAccount(email);
		else if (!trip && followingTrip && !activating && email && tripAccount && sameEmail(tripAccount, email)) setTripAccount(null);
		followingTrip = running;
	});
	setTripDockedListener(tripCode => {
		dockedTrip = tripCode;
		const email = activeEmail();
		if (email && tripAccount && sameEmail(tripAccount, email)) setTripAccount(null);
	});

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
	const unsubscribers = [stopSaving, stopSavingMain, stopTripTracking, userCredentials.subscribe(trackActive), token.subscribe(trackActive), user.subscribe(trackActive)];

	setActiveTripRefusalHandler(retry => {
		if (!otherAccounts().length) return false;
		accountPicker.set({ reason: 'active-trip', retry });
		return true;
	});
	setGhostTripHandler(() => {
		if (!otherAccounts().length || get(switchingTo)) return false;
		accountPicker.set({ reason: 'ghost-trip' });
		return true;
	});

	return () => {
		unsubscribers.forEach(unsubscribe => unsubscribe());
		setActiveTripRefusalHandler(null);
		setGhostTripHandler(null);
		setTripDockedListener(null);
		started = null;
	};
}

/** A session for the account: its saved refresh token while that's still valid, otherwise a full login. */
export async function signIn(account: SavedAccount): Promise<VaimooSession> {
	if (account.refreshToken) {
		try {
			return await refreshVaimooSession(account.refreshToken);
		} catch (error) {
			console.debug('Saved session no longer valid, logging in again', error);
		}
	}
	return loginWithEmel(account.email, account.password);
}

/** Keep the rotated refresh token of a session opened for an account that isn't the active one. */
export function rememberSession(email: string, session: VaimooSession) {
	const active = activeEmail();
	if (active && sameEmail(active, email)) return;
	upsert({ email, userId: session.userId, refreshToken: session.refreshToken });
}

const inFlight = () => [tokenRefreshInFlight(), tripStatusInFlight()].filter(request => request != null);

/**
 * Wait for a token refresh or trip check of the current account that is already under way: finishing after the
 * switch, it would put the previous account's session or trip back. Gives up after SETTLE_TIMEOUT_MS.
 */
async function settleActiveSession() {
	const deadline = Date.now() + SETTLE_TIMEOUT_MS;
	for (let pending = inFlight(); pending.length && Date.now() < deadline; pending = inFlight()) {
		let timer: ReturnType<typeof setTimeout> | undefined;
		await Promise.race([Promise.allSettled(pending), new Promise(resolve => timer = setTimeout(resolve, deadline - Date.now()))]);
		clearTimeout(timer);
	}
}

/** The new account's pass and balance, or null when they can't be had within SNAPSHOT_WAIT_MS. */
async function preloadSnapshot(session: VaimooSession): Promise<AccountSnapshot | null> {
	let timer: ReturnType<typeof setTimeout> | undefined;
	const late = new Promise<null>(resolve => timer = setTimeout(() => resolve(null), SNAPSHOT_WAIT_MS));
	try {
		return await Promise.race([accountSnapshotFor(session).catch(() => null), late]);
	} finally {
		clearTimeout(timer);
	}
}

/** Set while activate() swaps the stores, so clearing the previous account's trip doesn't count as the trip ending. */
let activating = false;

/**
 * Make the account active, the way logging out and back in would but without the login screen in between. A `fresh`
 * snapshot was just loaded; any other is refreshed afterwards.
 */
function activate(account: SavedAccount, session: VaimooSession, snapshot: AccountSnapshot | null = null, fresh = snapshot !== null) {
	activating = true;
	try {
		swapIn(account, session, snapshot, fresh);
	} finally {
		activating = false;
	}
}

/** With a snapshot loaded beforehand, the profile's pass and balance change together with the name, without a gap. */
function swapIn(account: SavedAccount, session: VaimooSession, snapshot: AccountSnapshot | null, fresh: boolean) {
	stopBackendSync();
	currentTrip.set(null);
	tripRating.set({ currentRating: null });
	accountInfo.set(snapshot);
	userCredentials.set({ email: account.email, password: account.password });
	// Setting the token restarts the backend sync, which loads this account's active trip
	token.set({
		accessToken: session.accessToken,
		refreshToken: session.refreshToken,
		expiration: session.expiresAt,
		userId: session.userId,
		tenantId: session.user.tenantId,
	});
	// The saved name stands in until updateUserInfo loads it, so it doesn't flash the email first
	user.set({ email: session.user.email ?? account.email, name: displayName(session, account.name || account.email) });
	if (!fresh) {
		void refreshAccountInfo().catch(error => {
			console.error('Failed to load VAIMOO account data', error);
			void reportApiError('account_info_error', error, { source: 'account-switch' });
		});
	}
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
		const recent = knownSnapshot(target.email, SNAPSHOT_REUSE_MS);
		// Load the pass and balance meanwhile, unless they were seen recently; without them the switch still happens and
		// loads them afterwards
		const [snapshot] = await Promise.all([recent ? null : preloadSnapshot(session), settleActiveSession()]);
		const leaving = activeEmail(), leavingInfo = get(accountInfo);
		if (leaving && leavingInfo) rememberSnapshot(leaving, leavingInfo);
		activate(target, session, snapshot ?? recent, snapshot !== null);
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
	if (account) {
		await settleActiveSession();
		activate(account, session);
	}
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
	forgetSnapshot(email);
	const main = get(mainAccount);
	if (main && sameEmail(main, email)) mainAccount.set(null);
	if (tripAccount && sameEmail(tripAccount, email)) setTripAccount(null);
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