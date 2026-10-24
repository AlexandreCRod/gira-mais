import { get } from 'svelte/store';
import { describe, expect, it } from 'vitest';
import { accountMenu, closeAccountMenu, openAccountMenu } from './account-menu';

describe('account menu', () => {
	it('hangs from the held button and closes once', () => {
		const button = document.createElement('div');
		button.getBoundingClientRect = () => ({ bottom: 80, right: window.innerWidth - 16 } as DOMRect);
		openAccountMenu(button);
		expect(get(accountMenu)).toEqual({ top: 80, right: 16 });

		expect(closeAccountMenu()).toBe(true);
		expect(get(accountMenu)).toBeNull();
		// A second back press goes on to what the map page does with it
		expect(closeAccountMenu()).toBe(false);
	});
});