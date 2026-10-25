// Gira+ Multi: the profile page's accounts. Swiping the page's header (name, pass, balance) sideways moves to the
// previous or next saved account, and past the last one to an empty profile for adding another; a press and hold on it
// makes its account the main one. The header only gets an action and the exit button a handler, so Profile.svelte
// keeps small hooks. The questions these may ask live in ProfileAccounts.svelte, which registers itself here.
import { userCredentials } from '$lib/account';
import type { AccountSnapshot } from '$lib/gira-api/models';
import { mainAccount, sameEmail, savedAccounts } from '$lib/accounts';
import { hold } from '$lib/hold';
import { SIDEWAYS_COMMIT_PX, swipeSideways } from '$lib/swipe';
import { get, writable } from 'svelte/store';

const SLIDE_MS = 180;

/** Showing the empty profile past the last account. */
export const newAccountPage = writable(false);

/**
 * The account a swipe is switching to, while it loads. Its name and email stand in for the header straight away, so
 * the switch doesn't leave a blank gap, with the last known pass and balance if the app has seen them; the header comes
 * back with the current ones once it's done.
 */
export const pendingAccount = writable<{ email: string, name: string, snapshot: AccountSnapshot | null, direction: 1 | -1 } | null>(null);

/**
 * The page a swipe lands on, or null past either end. The pages are the saved accounts in order, then the empty
 * profile (page `count`). `direction` is 1 for the next page (a swipe to the left), -1 for the previous one.
 */
export function targetPage(count: number, current: number, direction: 1 | -1): number | null {
	const target = current + direction;
	return target < 0 || target > count ? null : target;
}

type Handlers = {
	/** Carry out a swipe; resolves to whether the page changed. */
	swipe: (direction: 1 | -1) => Promise<boolean>,
	signOut: () => void,
};
let handlers: Handlers | null = null;

/** ProfileAccounts.svelte carries out the swipes and the exit button. Returns the unregister. */
export function registerProfileAccounts(next: Handlers) {
	handlers = next;
	return () => {
		if (handlers === next) handlers = null;
	};
}

export const profileSwipe = (direction: 1 | -1) => handlers?.swipe(direction) ?? Promise.resolve(false);

/** The profile page's exit button: asks, then removes the account on screen. */
export const requestSignOut = () => handlers?.signOut();

/** Make the active account the main one, or stop it being main. Only with more than one account, where it matters. */
export function toggleMain() {
	const active = get(userCredentials)?.email;
	if (!active || get(savedAccounts).length < 2) return;
	const main = get(mainAccount);
	mainAccount.set(main && sameEmail(main, active) ? null : active);
}

/** Upstream's profile header: follows a sideways drag, slides out to the next page and back in once it's there. */
export function profileHeader(node: HTMLElement) {
	let busy = false;
	const width = () => node.offsetWidth || window.innerWidth;
	const place = (x: number, opacity: number, animated: boolean) => {
		node.style.transition = animated ? `transform ${SLIDE_MS}ms ease-out, opacity ${SLIDE_MS}ms ease-out` : 'none';
		node.style.transform = x ? `translateX(${x}px)` : '';
		node.style.opacity = opacity === 1 ? '' : String(opacity);
	};
	// Start off to one side without animating, then let the transition bring it to the middle
	const enterFrom = (side: 1 | -1) => {
		place(side * width(), 0, false);
		void node.offsetWidth;
		place(0, 1, true);
	};

	const drag = swipeSideways(node, {
		move: dx => {
			if (!busy) place(dx, 1 - Math.min(Math.abs(dx) / width(), 1) / 2, false);
		},
		end: dx => {
			if (busy) return;
			if (Math.abs(dx) < SIDEWAYS_COMMIT_PX) {
				place(0, 1, true);
				return;
			}
			const direction = dx < 0 ? 1 : -1;
			busy = true;
			place(-direction * width(), 0, true);
			void profileSwipe(direction).then(changed => {
				busy = false;
				// Hidden behind the empty profile, or already back in place after the stand-in
				if (!changed && !hiddenBy) place(0, 1, true);
			});
		},
	});

	// What the header is hidden behind: the empty profile, or the stand-in while a swipe's switch loads
	let hiddenBy: 'new' | 'pending' | null = null;
	const updateHidden = () => {
		const next = get(newAccountPage) ? 'new' : get(pendingAccount) ? 'pending' : null;
		if (next === hiddenBy) return;
		const previous = hiddenBy;
		hiddenBy = next;
		node.style.display = next ? 'none' : '';
		// Back from the empty profile, which is to the right of every account
		if (previous === 'new' && !next) enterFrom(-1);
		// The stand-in already slid into place: the header takes its spot without moving
		else if (previous === 'pending' && !next) place(0, 1, false);
	};
	const stopPage = newAccountPage.subscribe(updateHidden);
	const stopPending = pendingAccount.subscribe(updateHidden);

	let email: string | null | undefined;
	const stopAccount = userCredentials.subscribe(credentials => {
		const next = credentials?.email ?? null;
		// Changed by something other than a swipe (removing the account on screen): bring the next one in
		if (email !== undefined && next !== email && !busy && !hiddenBy) enterFrom(1);
		email = next;
	});

	const held = hold(node, toggleMain);

	return {
		destroy() {
			drag.destroy();
			held.destroy();
			stopPage();
			stopPending();
			stopAccount();
		},
	};
}