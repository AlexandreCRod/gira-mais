import { describe, expect, it, vi } from 'vitest';
import { userCredentials } from '$lib/account';
import { fadeOnAccountChange } from './account-fade';

vi.mock('$lib/account', async () => {
	const { writable } = await import('svelte/store');
	return { userCredentials: writable<{ email: string, password: string } | null>(null) };
});

describe('fadeOnAccountChange', () => {
	it('fades in only when the account changes', () => {
		userCredentials.set({ email: 'alice@example.com', password: 'a' });
		const node = document.createElement('div');
		const animate = vi.fn();
		node.animate = animate;
		const action = fadeOnAccountChange(node);
		expect(animate).not.toHaveBeenCalled();

		userCredentials.set({ email: 'alice@example.com', password: 'a' });
		expect(animate).not.toHaveBeenCalled();

		userCredentials.set({ email: 'bob@example.com', password: 'b' });
		expect(animate).toHaveBeenCalledTimes(1);

		action.destroy();
		userCredentials.set({ email: 'alice@example.com', password: 'a' });
		expect(animate).toHaveBeenCalledTimes(1);
	});
});