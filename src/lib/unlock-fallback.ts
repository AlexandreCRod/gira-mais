// Gira+ Multi: lets trip.ts offer the other saved accounts when an unlock is refused because this account
// already has a trip (often a ghost trip), without trip.ts depending on the account switcher itself.
import { VaimooApiError } from '$lib/vaimoo-api/client';

/** VAIMOO's error code for "the user already has an active trip", from the official app's error enum. */
const ACTIVE_TRIP_ERROR_CODE = 1607;
const ACTIVE_TRIP_ERROR_MESSAGES = ['already_active_trip', 'already_has_active_trip'];

type Handler = (retry: () => Promise<boolean>) => boolean;
let handler: Handler | null = null;

export function setActiveTripRefusalHandler(next: Handler | null) {
	handler = next;
}

/** Whether VAIMOO refused the unlock because the account already has an active trip. */
export function isActiveTripRefusal(error: unknown) {
	if (!(error instanceof VaimooApiError)) return false;
	return error.code === ACTIVE_TRIP_ERROR_CODE || error.errors.some(item => ACTIVE_TRIP_ERROR_MESSAGES.includes(item.message));
}

/** Offer to retry the unlock with another account; false when there is none to offer. */
export function offerOtherAccounts(retry: () => Promise<boolean>) {
	return handler?.(retry) ?? false;
}