// Gira+ Multi: the account menu that opens when the map's profile button is held. Kept in a store so it survives the
// profile button's floating anchor re-keying its children, and so the map page's back-button handler can close it.
import { writable } from 'svelte/store';

/** Where the menu hangs from: the bottom right corner of the held button, in window coordinates. */
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