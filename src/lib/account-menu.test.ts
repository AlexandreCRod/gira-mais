import { get } from 'svelte/store';
import { describe, expect, it, vi } from 'vitest';
import { accountMenu, closeAccountMenu, closeAccountMenuOnTouch, openAccountMenu } from './account-menu';

describe('account menu', () => {
	it('hangs from the swiped button and closes once', () => {
		const button = document.createElement('div');
		button.getBoundingClientRect = () => ({ bottom: 80, right: window.innerWidth - 16 } as DOMRect);
		openAccountMenu(button);
		expect(get(accountMenu)).toEqual({ top: 80, right: 16 });

		expect(closeAccountMenu()).toBe(true);
		expect(get(accountMenu)).toBeNull();
		// A second back press goes on to what the map page does with it
		expect(closeAccountMenu()).toBe(false);
	});

	it('a touch outside closes it, and its click does not reach what is underneath', () => {
		vi.useFakeTimers();
		const map = document.createElement('div');
		document.body.append(map);
		const clicked = vi.fn();
		map.addEventListener('click', clicked);
		accountMenu.set({ top: 80, right: 16 });

		closeAccountMenuOnTouch();
		expect(get(accountMenu)).toBeNull();
		map.click();
		expect(clicked).not.toHaveBeenCalled();
		// Only that one click: the next tap works
		map.click();
		expect(clicked).toHaveBeenCalledOnce();

		// A tap that never produced a click stops being swallowed after a moment
		closeAccountMenuOnTouch();
		vi.advanceTimersByTime(600);
		map.click();
		expect(clicked).toHaveBeenCalledTimes(2);
		map.remove();
		vi.useRealTimers();
	});
});