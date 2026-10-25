import { get } from 'svelte/store';
import { describe, expect, it, vi } from 'vitest';
import { userCredentials } from '$lib/account';
import { mainAccount, savedAccounts } from '$lib/accounts';
import { targetPage, toggleMain } from './profile-accounts';

vi.mock('$lib/account', async () => {
	const { writable } = await import('svelte/store');
	return { userCredentials: writable<{ email: string, password: string } | null>(null) };
});
vi.mock('$lib/accounts', async () => {
	const { writable } = await import('svelte/store');
	return {
		savedAccounts: writable<{ email: string }[]>([]),
		mainAccount: writable<string | null>(null),
		sameEmail: (a: string, b: string) => a.toLowerCase() === b.toLowerCase(),
	};
});

describe('targetPage', () => {
	it('moves between the accounts, then to the empty profile after the last one', () => {
		expect(targetPage(3, 0, 1)).toBe(1);
		expect(targetPage(3, 2, 1)).toBe(3);
		expect(targetPage(3, 3, -1)).toBe(2);
	});

	it('stops at either end', () => {
		expect(targetPage(3, 0, -1)).toBeNull();
		expect(targetPage(3, 3, 1)).toBeNull();
		expect(targetPage(1, 0, 1)).toBe(1);
	});
});

describe('toggleMain', () => {
	it('makes the active account the main one, and a second hold undoes it', () => {
		savedAccounts.set([{ email: 'a@example.com' }, { email: 'b@example.com' }] as never);
		userCredentials.set({ email: 'B@example.com', password: 'b' });
		mainAccount.set('a@example.com');
		toggleMain();
		expect(get(mainAccount)).toBe('B@example.com');
		toggleMain();
		expect(get(mainAccount)).toBeNull();
	});

	it('does nothing with a single account', () => {
		savedAccounts.set([{ email: 'a@example.com' }] as never);
		userCredentials.set({ email: 'a@example.com', password: 'a' });
		mainAccount.set(null);
		toggleMain();
		expect(get(mainAccount)).toBeNull();
	});
});