// Gira+ Multi: paid trips in the history. A trip counts as paid when VAIMOO reports a cost above zero. The cost is
// shown in euros, the way the profile shows the balance.
import type { CompletedTrip } from '$lib/gira-api/models';

/** Pages loaded by themselves with "Paid only" on, before offering to look further back. Gira+ loads 15 trips a page. */
export const PAID_AUTO_PAGES = 10;

export const isPaidTrip = (trip: CompletedTrip) => (trip.cost ?? 0) > 0;

export const formatTripCost = (cost: number) => `${cost.toFixed(2)}€`;

type AutoLoad = { inView: () => boolean, done: () => boolean, load: () => Promise<void>, settle: () => Promise<void>, limit: number };

/** Load pages while the end of the list stays in view, at most `limit`. Returns how many were loaded. */
export async function loadWhileInView({ inView, done, load, settle, limit }: AutoLoad) {
	let pages = 0;
	while (pages < limit && inView() && !done()) {
		await load();
		pages++;
		await settle();
	}
	return pages;
}