import { describe, expect, it, vi } from 'vitest';
import type { CompletedTrip } from '$lib/gira-api/models';
import { formatTripCost, isPaidTrip, loadWhileInView } from './paid-trips';

const trip = (cost: number | null) => ({ cost } as CompletedTrip);
const settle = async () => {};

describe('paid trips', () => {
	it('counts a trip as paid only when it cost something', () => {
		expect(isPaidTrip(trip(0.5))).toBe(true);
		expect(isPaidTrip(trip(0))).toBe(false);
		expect(isPaidTrip(trip(null))).toBe(false);
	});

	it('shows the cost the way the balance is shown', () => {
		expect(formatTripCost(0.5)).toBe('0.50€');
		expect(formatTripCost(12)).toBe('12.00€');
	});
});

describe('loadWhileInView', () => {
	it('stops once the end of the list is out of view', async () => {
		let pages = 0;
		const load = vi.fn(async () => { pages++; });
		expect(await loadWhileInView({ inView: () => pages < 3, done: () => false, load, settle, limit: 10 })).toBe(3);
	});

	it('stops when everything is loaded', async () => {
		let pages = 0;
		const load = vi.fn(async () => { pages++; });
		expect(await loadWhileInView({ inView: () => true, done: () => pages === 2, load, settle, limit: 10 })).toBe(2);
	});

	it('loads at most the limit at a time', async () => {
		const load = vi.fn(async () => {});
		expect(await loadWhileInView({ inView: () => true, done: () => false, load, settle, limit: 10 })).toBe(10);
		expect(load).toHaveBeenCalledTimes(10);
	});
});