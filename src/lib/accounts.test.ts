import { get } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VaimooSession } from '$lib/vaimoo-api/types';
import * as account from '$lib/account';
import * as trip from '$lib/trip';
import * as fallback from '$lib/unlock-fallback';
import * as ghost from '$lib/ghost-trip';
import * as accounts from './accounts';
import { forgetSnapshot, knownSnapshot, rememberSnapshot } from '$lib/account-snapshot';
import { InvalidCredentialsError } from '$lib/vaimoo-api/client';

const mocks = vi.hoisted(() => ({
	preferences: new Map<string, string>,
	loginWithEmel: vi.fn(),
	refreshVaimooSession: vi.fn(),
	stopBackendSync: vi.fn(),
	logOut: vi.fn(),
	refreshInFlight: null as Promise<unknown> | null,
	statusInFlight: null as Promise<unknown> | null,
	remainingCredit: vi.fn(async () => ({ remainingCredit: 4.5 })),
	subscriptionUsage: vi.fn(async () => [] as unknown[]),
}));

vi.mock('@capacitor/preferences', () => ({
	Preferences: {
		get: vi.fn(async ({ key }: { key: string }) => ({ value: mocks.preferences.get(key) ?? null })),
		set: vi.fn(async ({ key, value }: { key: string, value: string }) => { mocks.preferences.set(key, value); }),
		remove: vi.fn(async ({ key }: { key: string }) => { mocks.preferences.delete(key); }),
	},
}));
vi.mock('$lib/account', async () => {
	const { writable } = await import('svelte/store');
	const token = writable<unknown>(null);
	const userCredentials = writable<{ email: string, password: string } | null>(null);
	mocks.logOut.mockImplementation(async () => {
		token.set(null);
		userCredentials.set(null);
	});
	return {
		token,
		userCredentials,
		user: writable(null),
		accountInfo: writable(null),
		logOut: mocks.logOut,
		refreshAccountInfo: vi.fn(async () => ({})),
		updateUserInfo: vi.fn(async () => {}),
		tokenRefreshInFlight: () => mocks.refreshInFlight,
	};
});
vi.mock('$lib/trip', async () => {
	const { writable } = await import('svelte/store');
	return { currentTrip: writable(null), tripRating: writable({ currentRating: null }), DEBUG_TRIP_CODE: 'DEBUG-TRIP', tripStatusInFlight: () => mocks.statusInFlight };
});
vi.mock('$lib/gira-api/backend-sync', () => ({ stopBackendSync: mocks.stopBackendSync }));
vi.mock('$lib/error-reporting', () => ({ reportApiError: vi.fn() }));
vi.mock('$lib/vaimoo-api/client', () => {
	class VaimooApiError extends Error {
		code = null;

		errors = [];
	}
	class InvalidCredentialsError extends VaimooApiError {}
	return {
		VaimooApiError,
		InvalidCredentialsError,
		loginWithEmel: mocks.loginWithEmel,
		refreshVaimooSession: mocks.refreshVaimooSession,
		getVaimooRemainingCredit: mocks.remainingCredit,
		getVaimooSubscriptionUsage: mocks.subscriptionUsage,
	};
});

const ALICE = { email: 'alice@example.com', password: 'alice-pass', name: 'Alice', userId: 1, refreshToken: 'alice-refresh' };
const BOB = { email: 'bob@example.com', password: 'bob-pass', name: 'Bob', userId: 2, refreshToken: 'bob-refresh' };

function session(userId: number, email: string, refreshToken = `refresh-${userId}-new`) {
	return {
		accessToken: `access-${userId}`,
		refreshToken,
		userId,
		expiresAt: Date.now() + 300_000,
		user: { userId, tenantId: 'tenant', email, firstName: 'User', lastName: String(userId) },
	} as unknown as VaimooSession;
}

function tokenFor(userId: number, refreshToken: string) {
	return { accessToken: `access-${userId}`, refreshToken, expiration: Date.now() + 300_000, userId, tenantId: 'tenant' };
}

let stopTracking: (() => void) | null = null;

/** A clean slate for each test: the stores are shared module state, so reset them before tracking starts. */
async function setup(saved: unknown[] = [], active: typeof ALICE | null = null) {
	mocks.preferences.clear();
	forgetSnapshot();
	account.accountInfo.set(null);
	if (saved.length) mocks.preferences.set('multi/accounts', JSON.stringify(saved));
	account.token.set(null);
	account.userCredentials.set(null);
	account.user.set(null);
	trip.currentTrip.set(null);
	accounts.accountPicker.set(null);
	if (active) {
		account.userCredentials.set({ email: active.email, password: active.password });
		account.token.set(tokenFor(active.userId, active.refreshToken));
	}
	stopTracking = await accounts.initAccounts();
	return { account, trip, fallback, accounts };
}

afterEach(() => {
	stopTracking?.();
	stopTracking = null;
});

const stored = () => JSON.parse(mocks.preferences.get('multi/accounts') ?? '[]');

describe('saved accounts', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('saves the account that was already logged in, as upstream Gira+ kept it', async () => {
		const { accounts } = await setup([], ALICE);
		expect(get(accounts.savedAccounts)).toEqual([{ email: ALICE.email, password: ALICE.password, name: ALICE.email, userId: 1, refreshToken: 'alice-refresh' }]);
		expect(stored()).toHaveLength(1);
	});

	it('saves an account on its first login', async () => {
		const { account, accounts } = await setup();
		account.token.set(tokenFor(1, 'alice-refresh'));
		account.userCredentials.set({ email: ALICE.email, password: ALICE.password });
		account.user.set({ email: ALICE.email, name: 'Alice A' });
		expect(get(accounts.savedAccounts)).toEqual([{ email: ALICE.email, password: ALICE.password, name: 'Alice A', userId: 1, refreshToken: 'alice-refresh' }]);
	});

	it('tracks the active account\'s rotating refresh token and leaves the others alone', async () => {
		const { account, accounts } = await setup([ALICE, BOB], ALICE);
		account.token.set(tokenFor(1, 'alice-rotated'));
		expect(get(accounts.savedAccounts)).toEqual([{ ...ALICE, refreshToken: 'alice-rotated' }, BOB]);
		expect(stored()[0].refreshToken).toBe('alice-rotated');
	});

	it('ignores a late token for another account', async () => {
		const { account, accounts } = await setup([ALICE, BOB], ALICE);
		account.token.set(tokenFor(2, 'stray'));
		expect(get(accounts.savedAccounts)[0].refreshToken).toBe('alice-refresh');
	});

	it('skips saved entries it can\'t read', async () => {
		const { accounts } = await setup([ALICE, { email: 'no-password@example.com' }, 'junk']);
		expect(get(accounts.savedAccounts)).toEqual([ALICE]);
	});
});

describe('switchAccount', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('switches with the saved session while it is still valid', async () => {
		const { account, trip, accounts } = await setup([ALICE, BOB], ALICE);
		trip.currentTrip.set({ code: 'ghost' } as never);
		mocks.refreshVaimooSession.mockResolvedValue(session(2, BOB.email));

		expect(await accounts.switchAccount(BOB.email)).toBe('ok');

		expect(mocks.refreshVaimooSession).toHaveBeenCalledWith('bob-refresh');
		expect(mocks.loginWithEmel).not.toHaveBeenCalled();
		expect(mocks.stopBackendSync).toHaveBeenCalled();
		expect(get(trip.currentTrip)).toBeNull();
		expect(get(account.userCredentials)).toEqual({ email: BOB.email, password: BOB.password });
		expect(get(account.token)).toMatchObject({ userId: 2, refreshToken: 'refresh-2-new' });
		expect(get(account.user)).toEqual({ email: BOB.email, name: 'User 2' });
		expect(get(accounts.savedAccounts)[1].refreshToken).toBe('refresh-2-new');
		expect(get(accounts.savedAccounts)[0].refreshToken).toBe('alice-refresh');
	});

	it('loads the pass and balance of the new account before showing it, so they change with the name', async () => {
		const { account, accounts } = await setup([ALICE, BOB], ALICE);
		mocks.refreshVaimooSession.mockResolvedValue(session(2, BOB.email));

		expect(await accounts.switchAccount(BOB.email)).toBe('ok');
		expect(mocks.remainingCredit).toHaveBeenCalledWith(expect.objectContaining({ userId: 2 }));
		expect(get(account.accountInfo)).toEqual({ balance: 4.5, subscription: null });
		expect(account.refreshAccountInfo).not.toHaveBeenCalled();
	});

	it('uses a pass and balance seen in the last 3 minutes at once, and lets Gira+ refresh them after', async () => {
		const { account, accounts } = await setup([ALICE, BOB], ALICE);
		mocks.refreshVaimooSession.mockResolvedValue(session(2, BOB.email));
		rememberSnapshot(BOB.email, { balance: -1, subscription: null });

		expect(await accounts.switchAccount(BOB.email)).toBe('ok');
		expect(mocks.remainingCredit).not.toHaveBeenCalled();
		expect(get(account.accountInfo)).toEqual({ balance: -1, subscription: null });
		expect(account.refreshAccountInfo).toHaveBeenCalled();
	});

	it('waits for the pass and balance again once what it saw is older than 3 minutes', async () => {
		const { accounts } = await setup([ALICE, BOB], ALICE);
		mocks.refreshVaimooSession.mockResolvedValue(session(2, BOB.email));
		rememberSnapshot(BOB.email, { balance: -1, subscription: null }, Date.now() - accounts.SNAPSHOT_REUSE_MS - 1);

		expect(await accounts.switchAccount(BOB.email)).toBe('ok');
		expect(mocks.remainingCredit).toHaveBeenCalled();
	});

	it('remembers the pass and balance of the account it leaves', async () => {
		const { account, accounts } = await setup([ALICE, BOB], ALICE);
		mocks.refreshVaimooSession.mockResolvedValue(session(2, BOB.email));
		account.accountInfo.set({ balance: 7, subscription: null } as never);

		expect(await accounts.switchAccount(BOB.email)).toBe('ok');
		expect(knownSnapshot(ALICE.email)).toEqual({ balance: 7, subscription: null });
	});

	it('falls back to the pass and balance refresh of Gira+ when the preload fails', async () => {
		const { account, accounts } = await setup([ALICE, BOB], ALICE);
		mocks.refreshVaimooSession.mockResolvedValue(session(2, BOB.email));
		mocks.remainingCredit.mockRejectedValueOnce(new Error('offline'));

		expect(await accounts.switchAccount(BOB.email)).toBe('ok');
		expect(get(account.accountInfo)).toBeNull();
		expect(account.refreshAccountInfo).toHaveBeenCalled();
	});

	it('does not hold the switch up for more than 3 seconds waiting for the pass and balance', async () => {
		const { account, accounts } = await setup([ALICE, BOB], ALICE);
		mocks.refreshVaimooSession.mockResolvedValue(session(2, BOB.email));
		mocks.remainingCredit.mockReturnValueOnce(new Promise(() => {}));
		vi.useFakeTimers();
		try {
			const result = accounts.switchAccount(BOB.email);
			await vi.advanceTimersByTimeAsync(3_000);
			expect(await result).toBe('ok');
		} finally {
			vi.useRealTimers();
		}
		expect(get(account.token)).toMatchObject({ userId: 2 });
		expect(account.refreshAccountInfo).toHaveBeenCalled();
	});

	it('logs in again when the saved session has expired', async () => {
		const { account, accounts } = await setup([ALICE, BOB], ALICE);
		mocks.refreshVaimooSession.mockRejectedValue(new Error('expired'));
		mocks.loginWithEmel.mockResolvedValue(session(2, BOB.email));

		expect(await accounts.switchAccount(BOB.email)).toBe('ok');
		expect(mocks.loginWithEmel).toHaveBeenCalledWith(BOB.email, BOB.password);
		expect(get(account.token)).toMatchObject({ userId: 2 });
	});

	it('keeps the active account when the other one\'s password is rejected', async () => {
		const { account, accounts } = await setup([ALICE, { ...BOB, refreshToken: null }], ALICE);
		mocks.loginWithEmel.mockRejectedValue(new InvalidCredentialsError('rejected', null));

		expect(await accounts.switchAccount(BOB.email)).toBe('invalid-credentials');
		expect(mocks.stopBackendSync).not.toHaveBeenCalled();
		expect(get(account.token)).toMatchObject({ userId: 1 });
		expect(get(account.userCredentials)?.email).toBe(ALICE.email);
	});

	it('reports network trouble as a failed switch', async () => {
		const { account, accounts } = await setup([ALICE, { ...BOB, refreshToken: null }], ALICE);
		mocks.loginWithEmel.mockRejectedValue(new Error('offline'));

		expect(await accounts.switchAccount(BOB.email)).toBe('failed');
		expect(get(account.token)).toMatchObject({ userId: 1 });
		expect(get(accounts.switchingTo)).toBeNull();
	});
});

describe('addAccount', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('adds the account and makes it active', async () => {
		const { account, accounts } = await setup([ALICE], ALICE);
		mocks.loginWithEmel.mockResolvedValue(session(2, BOB.email));

		expect(await accounts.addAccount(BOB.email, BOB.password)).toBe(0);
		expect(get(accounts.savedAccounts).map(saved => saved.email)).toEqual([ALICE.email, BOB.email]);
		expect(get(account.userCredentials)?.email).toBe(BOB.email);
		expect(get(account.token)).toMatchObject({ userId: 2 });
	});

	it('returns 100 for wrong credentials and saves nothing', async () => {
		const { accounts } = await setup([ALICE], ALICE);
		mocks.loginWithEmel.mockRejectedValue(new InvalidCredentialsError('rejected', null));

		expect(await accounts.addAccount(BOB.email, 'wrong')).toBe(100);
		expect(get(accounts.savedAccounts)).toHaveLength(1);
	});
});

describe('removeAccount', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('removes an inactive account without switching', async () => {
		const { account, accounts } = await setup([ALICE, BOB], ALICE);
		expect(await accounts.removeAccount(BOB.email)).toBe('ok');
		expect(get(accounts.savedAccounts)).toEqual([ALICE]);
		expect(get(account.userCredentials)?.email).toBe(ALICE.email);
	});

	it('switches to the next account before removing the active one', async () => {
		const { account, accounts } = await setup([ALICE, BOB], ALICE);
		mocks.refreshVaimooSession.mockResolvedValue(session(2, BOB.email));

		expect(await accounts.removeAccount(ALICE.email)).toBe('ok');
		expect(get(accounts.savedAccounts).map(saved => saved.email)).toEqual([BOB.email]);
		expect(get(account.userCredentials)?.email).toBe(BOB.email);
	});

	it('keeps the active account when the switch to the next one fails', async () => {
		const { accounts } = await setup([ALICE, { ...BOB, refreshToken: null }], ALICE);
		mocks.loginWithEmel.mockRejectedValue(new Error('offline'));

		expect(await accounts.removeAccount(ALICE.email)).toBe('failed');
		expect(get(accounts.savedAccounts)).toHaveLength(2);
	});

	it('logs out when removing the last account', async () => {
		const { account, accounts } = await setup([ALICE], ALICE);
		expect(await accounts.signOutActive()).toBe('ok');
		expect(mocks.logOut).toHaveBeenCalled();
		expect(get(account.token)).toBeNull();
		expect(get(accounts.savedAccounts)).toEqual([]);
	});
});

describe('unlock refused for an active trip', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('offers the other accounts, with the unlock to retry', async () => {
		const { accounts, fallback } = await setup([ALICE, BOB], ALICE);
		const retry = async () => true;
		expect(fallback.offerOtherAccounts(retry)).toBe(true);
		expect(get(accounts.accountPicker)).toEqual({ reason: 'active-trip', retry });
	});

	it('offers nothing with a single account', async () => {
		const { accounts, fallback } = await setup([ALICE], ALICE);
		expect(fallback.offerOtherAccounts(async () => true)).toBe(false);
		expect(get(accounts.accountPicker)).toBeNull();
	});
});

describe('ghost trip', () => {
	afterEach(() => ghost.ghostTripReset());

	it('opens the account picker once the trip counts as a ghost trip', async () => {
		const { accounts } = await setup([ALICE, BOB], ALICE);
		ghost.ghostTripSignal('123', 0);
		ghost.ghostTripStillOpen('123', ghost.GHOST_TRIP_AFTER_MS);
		expect(get(accounts.accountPicker)).toEqual({ reason: 'ghost-trip' });
	});

	it('offers nothing with a single account', async () => {
		const { accounts } = await setup([ALICE], ALICE);
		ghost.ghostTripSignal('123', 0);
		ghost.ghostTripStillOpen('123', ghost.GHOST_TRIP_AFTER_MS);
		expect(get(accounts.accountPicker)).toBeNull();
	});
});

/** A request that's under way until finish() is called, like upstream's shared refresh and trip-check promises. */
function underWay(slot: 'refreshInFlight' | 'statusInFlight', onFinish: () => void) {
	let finish!: () => void;
	mocks[slot] = new Promise<void>(resolve => finish = resolve).then(onFinish).finally(() => mocks[slot] = null);
	return () => finish();
}

describe('a switch while the previous account is busy', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.refreshInFlight = null;
		mocks.statusInFlight = null;
	});

	it('lets a token refresh already under way finish before switching', async () => {
		const { account, accounts } = await setup([ALICE, BOB], ALICE);
		mocks.refreshVaimooSession.mockResolvedValue(session(2, BOB.email));
		const finish = underWay('refreshInFlight', () => account.token.set(tokenFor(1, 'alice-late')));

		const switching = accounts.switchAccount(BOB.email);
		await Promise.resolve();
		finish();
		expect(await switching).toBe('ok');

		expect(get(account.token)).toMatchObject({ userId: 2 });
		expect(get(accounts.savedAccounts)[0].refreshToken).toBe('alice-late');
	});

	it('lets a trip check already under way finish before switching', async () => {
		const { trip, accounts } = await setup([ALICE, BOB], ALICE);
		mocks.refreshVaimooSession.mockResolvedValue(session(2, BOB.email));
		const finish = underWay('statusInFlight', () => trip.currentTrip.set({ code: 'alice-trip', confirmed: true } as never));

		const switching = accounts.switchAccount(BOB.email);
		await Promise.resolve();
		finish();
		expect(await switching).toBe('ok');

		expect(get(trip.currentTrip)).toBeNull();
	});

	it('stops waiting after ten seconds', async () => {
		const { account, accounts } = await setup([ALICE, BOB], ALICE);
		mocks.refreshVaimooSession.mockResolvedValue(session(2, BOB.email));
		vi.useFakeTimers();
		try {
			mocks.refreshInFlight = new Promise(() => {});
			const switching = accounts.switchAccount(BOB.email);
			await vi.advanceTimersByTimeAsync(10_000);
			expect(await switching).toBe('ok');
			expect(get(account.token)).toMatchObject({ userId: 2 });
		} finally {
			vi.useRealTimers();
			mocks.refreshInFlight = null;
		}
	});
});

describe('main account', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	function storedLogin(main: string | null, last: string | null, tripAccount: string | null = null) {
		mocks.preferences.clear();
		mocks.preferences.set('multi/accounts', JSON.stringify([ALICE, BOB]));
		if (main) mocks.preferences.set('multi/mainAccount', main);
		if (tripAccount) mocks.preferences.set('multi/tripAccount', tripAccount);
		if (last) {
			const lastAccount = [ALICE, BOB].find(saved => saved.email === last)!;
			mocks.preferences.set('email', lastAccount.email);
			mocks.preferences.set('password', lastAccount.password);
		}
	}

	it('points upstream\'s saved login at the main account before it logs in', async () => {
		storedLogin(BOB.email, ALICE.email);
		await accounts.chooseStartupAccount();
		expect(mocks.preferences.get('email')).toBe(BOB.email);
		expect(mocks.preferences.get('password')).toBe(BOB.password);
	});

	it('opens on the account whose trip was still running, for that start only', async () => {
		storedLogin(BOB.email, BOB.email, ALICE.email);
		await accounts.chooseStartupAccount();
		expect(mocks.preferences.get('email')).toBe(ALICE.email);
		expect(mocks.preferences.has('multi/tripAccount')).toBe(false);
	});

	it('leaves a logged-out app and a missing main account alone', async () => {
		storedLogin(BOB.email, null);
		await accounts.chooseStartupAccount();
		expect(mocks.preferences.has('email')).toBe(false);
		storedLogin(null, ALICE.email);
		await accounts.chooseStartupAccount();
		expect(mocks.preferences.get('email')).toBe(ALICE.email);
	});

	it('is saved, and forgotten with its account', async () => {
		const { accounts } = await setup([ALICE, BOB], ALICE);
		accounts.mainAccount.set(BOB.email);
		await Promise.resolve();
		expect(mocks.preferences.get('multi/mainAccount')).toBe(BOB.email);
		expect(await accounts.removeAccount(BOB.email)).toBe('ok');
		expect(get(accounts.mainAccount)).toBeNull();
		expect(mocks.preferences.has('multi/mainAccount')).toBe(false);
	});
});

describe('the account with a running trip', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.refreshInFlight = null;
		mocks.statusInFlight = null;
	});
	afterEach(() => ghost.ghostTripReset());

	const running = { code: '42', confirmed: true, finished: false } as never;

	it('is remembered while the trip runs and forgotten when it ends', async () => {
		const { trip } = await setup([ALICE, BOB], ALICE);
		trip.currentTrip.set(running);
		expect(mocks.preferences.get('multi/tripAccount')).toBe(ALICE.email);
		trip.currentTrip.set(null);
		expect(mocks.preferences.has('multi/tripAccount')).toBe(false);
	});

	it('is kept when switching away, since the trip goes on', async () => {
		const { trip, accounts } = await setup([ALICE, BOB], ALICE);
		mocks.refreshVaimooSession.mockResolvedValue(session(2, BOB.email));
		trip.currentTrip.set(running);
		expect(await accounts.switchAccount(BOB.email)).toBe('ok');
		expect(mocks.preferences.get('multi/tripAccount')).toBe(ALICE.email);
	});

	it('is forgotten once the bike is docked, ghost trip or not', async () => {
		const { trip } = await setup([ALICE, BOB], ALICE);
		trip.currentTrip.set(running);
		ghost.ghostTripSignal('42', 0);
		expect(mocks.preferences.has('multi/tripAccount')).toBe(false);
		trip.currentTrip.set({ code: '42', confirmed: true, finished: false } as never);
		expect(mocks.preferences.has('multi/tripAccount')).toBe(false);
	});
});