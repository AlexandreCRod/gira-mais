// Gira+ Multi: an action that fades an element back in when the active account changes, so the profile page's
// header (name, pass, balance) eases into the new account instead of jumping. An action keeps the hook in upstream's
// Profile.svelte down to one attribute.
import { userCredentials } from '$lib/account';

const FADE_MS = 250;

export function fadeOnAccountChange(node: HTMLElement) {
	let email: string | null | undefined;
	const stop = userCredentials.subscribe(credentials => {
		const next = credentials?.email ?? null;
		// The first value is the account the page opened on: nothing to fade from
		if (email !== undefined && next !== email && typeof node.animate === 'function') {
			node.animate([{ opacity: 0 }, { opacity: 1 }], { duration: FADE_MS, easing: 'ease-out' });
		}
		email = next;
	});
	return { destroy: stop };
}