// Gira+ Multi: the account menu that opens on a swipe down from the map's profile button. Kept in a store so it
// survives the profile button's floating anchor re-keying its children, and so the map page's back-button handler can
// close it.
import { writable } from 'svelte/store';

/** Where the menu hangs from: the bottom right corner of the swiped button, in window coordinates. */
export const accountMenu = writable<{ top: number, right: number } | null>(null);

export function openAccountMenu(anchor: HTMLElement) {
	const rect = anchor.getBoundingClientRect();
	accountMenu.set({ top: rect.bottom, right: window.innerWidth - rect.right });
}

/** Close the menu; true when it was open, so a back press stops there. */
export function closeAccountMenu() {
	let open = false;
	accountMenu.update(menu => {
		open = menu !== null;
		return null;
	});
	return open;
}

/** How long after the closing touch its click can still arrive. */
const CLICK_WINDOW_MS = 500;

/**
 * Close the menu from a touch outside it. It closes as soon as the finger lands: after the swipe that opened it the
 * browser can leave the next tap without a click, which made closing take two taps. The click that does follow can
 * land on the map under the menu (and pick a station), so it's swallowed.
 */
export function closeAccountMenuOnTouch() {
	closeAccountMenu();
	const swallow = (event: MouseEvent) => {
		event.preventDefault();
		event.stopImmediatePropagation();
		stop();
	};
	const stop = () => {
		window.removeEventListener('click', swallow, true);
		clearTimeout(timer);
	};
	window.addEventListener('click', swallow, true);
	const timer = setTimeout(stop, CLICK_WINDOW_MS);
}