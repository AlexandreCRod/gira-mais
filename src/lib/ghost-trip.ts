// Gira+ Multi: spots a ghost trip (one VAIMOO keeps open after the bike is docked) from what backend-sync.ts already
// learns, and lets the account picker offer another account. backend-sync reports Gira+'s own trip-end signal (the bike
// document says LOCKED with no trip) and every regular poll that still finds the trip; once the trip has stayed open
// that long after the signal, the offer is made once. Nothing is requested or reported for this.

/** How long VAIMOO may keep a trip open after its bike reported being docked before it counts as a ghost trip. */
export const GHOST_TRIP_AFTER_MS = 2 * 60_000;

/** Shows the offer; false when there is nothing to offer, so a later poll tries again. */
type Handler = () => boolean;
let handler: Handler | null = null;
let watch: { tripCode: string, signalledAt: number, offered: boolean } | null = null;

export function setGhostTripHandler(next: Handler | null) {
	handler = next;
}

/** The trip's bike reported being docked with no trip. Only the first report of a trip counts. */
export function ghostTripSignal(tripCode: string, now = Date.now()) {
	if (watch?.tripCode === tripCode) return;
	watch = { tripCode, signalledAt: now, offered: false };
}

/** A regular poll found VAIMOO still holding the trip; make the offer once it has outlived the docked signal. */
export function ghostTripStillOpen(tripCode: string, now = Date.now()) {
	if (!watch || watch.tripCode !== tripCode || watch.offered) return;
	if (now - watch.signalledAt < GHOST_TRIP_AFTER_MS) return;
	watch.offered = handler?.() ?? false;
}

/** The trip is no longer followed (it ended, the account changed or the sync stopped); a later signal starts over. */
export function ghostTripReset() {
	watch = null;
}