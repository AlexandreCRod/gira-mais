# Gira+ Multi

A personal fork of [Gira+](https://github.com/rt-evil-inc/gira-mais) that keeps several EMEL accounts saved in the app and switches between them without logging out. The main use is ghost trips: a trip that stays open after the bike is docked blocks that account from unlocking, and another account gets you riding again. Android only.

It installs next to Gira+ (own app id) and follows upstream's releases: each release here is the latest Gira+ release plus the changes below.

## Install

Download the APK from [Releases](../../releases), or add this repository's URL to [Obtainium](https://github.com/ImranR98/Obtainium) to get updates automatically.

## What changes compared to Gira+

- **Saved accounts.** Accounts are added and switched from the profile page. A switch reuses the account's last session while it's still valid, falls back to a full login, and leaves everything as it was unless the new session is ready.
- **Unlock fallback.** When VAIMOO refuses an unlock because the account already has a trip (error 1607), the app offers the other saved accounts and retries the same bike with the one picked.
- **Trip screen.** During a trip, a button offers the same switch, with a warning that the trip stops being tracked in the app.
- **Ghost-trip offer.** It uses Gira+'s own trip-end signal: the bike document says `LOCKED` with no trip id, and Gira+ then checks with VAIMOO. If VAIMOO still shows the trip open 2 minutes later on Gira+'s regular polls, the account picker opens once with "This trip looks stuck" and a "Not now" button. It makes no extra requests and reports nothing.
- **Main account.** Pressing and holding an account in the list makes it the one the app opens on, marked by a small "Main" line above its name. Holding it again turns this off. At startup, before Gira+ logs in, the fork points Gira+'s saved login at that account. Gira+ still logs in once, so opening is no slower and nothing switches afterwards. If a trip on another account was still running when the app closed (its bike not yet docked), that start opens on that account instead.
- **Account labels.** "Trip running", and "Pass expired" or "No pass" appear under each account in the list and in the switch popups. The active account's labels come from what the app already knows. Each other account is checked when a list is shown, at most once every 3 minutes, using the same three requests Gira+ makes for the active account: session refresh, current trip, and pass.
- **Safe switching.** A switch first waits (up to 10 seconds) for a token refresh or trip check of the previous account that's already under way. Otherwise that request could land after the switch and put the previous account back.
- **Smooth switch.** The new account's pass and balance are loaded during the switch, with the same two requests Gira+ makes for the active account, so the profile header shows them together with the name instead of a "—" first. The header then fades in. If that load fails or takes over 3 seconds, the switch goes ahead and Gira+'s own refresh fills them in as before.
- **Login form.** Autofill hints (`username` / `current-password`). The same form is reused as the add-account screen.
- **Own identity.** App id `io.github.alexandrecrod.giramais`, name "Gira+ Multi". The update check points at this fork, and its versions order as `1.7.1 < 1.7.1-multi.1 < 1.7.1-multi.2 < 1.7.2`.
- **Analytics off by default**, so this build's reports don't mix with Gira+'s. Bike ratings and arrival sharing are unchanged.
- **Android backups off** (`allowBackup="false"`). Saved passwords stay out of cloud backups; after a reinstall the accounts are added again.

## Where the code is

Fork code lives in new files, so rebasing onto upstream releases stays cheap:

| File | What it does |
| --- | --- |
| `src/lib/accounts.ts` | Saved accounts, switching, adding and removing |
| `src/lib/unlock-fallback.ts` | Recognises the "already has a trip" refusal and hands the retry to the account picker |
| `src/lib/ghost-trip.ts` | Turns Gira+'s trip-end signal plus VAIMOO still holding the trip into the ghost-trip offer |
| `src/lib/account-labels.ts` | Checks the other accounts' trip and pass for the labels, at most every 3 minutes |
| `src/lib/account-snapshot.ts` | Gira+'s pass and balance snapshot for any account, loaded before a switch |
| `src/lib/account-fade.ts` | Fades the profile header in when the account changes |
| `src/lib/fork.ts` | Release URLs and version ordering for this fork |
| `src/lib/fork-translations.ts` | The fork's own strings (pt/en) |
| `src/lib/components/AccountPicker.svelte`, `AccountPickerHost.svelte`, `AccountSwitcher.svelte`, `AccountLabels.svelte`, `MainCaption.svelte`, `TripAccountButton.svelte`, and `src/lib/hold.ts` (press and hold) | The account UI |
| `scripts/multi-release.js` | Stamps the release version at build time |
| `.github/workflows/multi-release.yml` | Rebases onto new upstream releases and publishes signed APKs |

Upstream files only get small hooks:

| File | Change |
| --- | --- |
| `src/lib/trip.ts` | On error 1607, offer the other accounts before showing the error |
| `src/lib/gira-api/backend-sync.ts` | Passes the trip-end signal, the regular poll results and the resets to `ghost-trip.ts` (5 lines) |
| `src/lib/account.ts`, end of file | Exposes the token refresh under way, so a switch can wait for it |
| `src/lib/trip.ts`, end of file | Exposes the trip check under way, for the same reason |
| `src/routes/+layout.svelte` | Runs `chooseStartupAccount` just before `loadUserCreds` |
| `src/lib/components/Login.svelte` | Autofill hints; optional title and login handler for the add-account screen |
| `src/lib/components/Profile.svelte` | Account switcher; sign-out goes through the saved accounts; `use:fadeOnAccountChange` on the header |
| `src/lib/components/InfoDialog.svelte` | Update check uses `src/lib/fork.ts` |
| `src/routes/+page.svelte` | Trip-screen button and the account picker host |
| `src/lib/translations.ts` | Merges the fork's strings |
| `src/lib/settings.ts` | Analytics off by default |
| `capacitor.config.json`, `android/app/build.gradle`, `android/app/src/main/res/values/strings.xml`, `scripts/build.js` | App id and name |
| `android/app/src/main/AndroidManifest.xml` | Backups off |

## Releases

Versions are the upstream version plus a revision: `1.7.1-multi.1`, `1.7.1-multi.2`, then `1.7.2-multi.1`. Android's versionCode is upstream's × 100 + the revision, so it always increases. Both are stamped at build time and never committed, so upstream's version lines don't conflict on rebase.

A daily GitHub Action checks for a new Gira+ release. When there is one, it rebases this branch onto it, runs the tests, builds a signed APK, pushes the branch and publishes a release. On a conflict or any failure it opens an issue and publishes nothing.

## Change log

- Own app id and name, analytics off by default, update check pointed at this fork.
- Saved accounts and switching, unlock fallback on error 1607, trip-screen switch button, login autofill hints.
- Signed releases that follow upstream automatically, Android backups off.
- Ghost-trip offer.
- Main account, account labels, and safe switching (the fix for a switch occasionally landing back on the previous account).
- Smooth switch: pass and balance loaded before the switch, and a fade on the profile header.

## Guesses and assumptions

These things were decided without confirmation from EMEL, VAIMOO or Gira+. Each entry says where to change it if it turns out wrong.

| Guess | Where to change it |
| --- | --- |
| VAIMOO error 1607 means "this account already has a trip". Taken from the official app's error list. | `ACTIVE_TRIP_ERROR_CODE` in `src/lib/unlock-fallback.ts` |
| A trip still open 2 minutes after its bike reported being docked is a ghost trip. How long EMEL normally takes to close a trip is unknown, so 2 minutes is a cautious pick. | `GHOST_TRIP_AFTER_MS` in `src/lib/ghost-trip.ts` |
| The bike's "couldn't end the trip" error codes are not treated as a ghost trip, because re-docking is usually the fix. Gira+ only shows an error for them. | `followActiveBike` in `backend-sync.ts` would need a call to `ghostTripSignal` |
| If someone else takes the bike before Gira+ sees it docked, the signal never comes and nothing is offered. The trip-screen button still works. | Accepted, to keep to Gira+'s signal |
| The offer shows once per trip. "Not now" holds until the account changes or the app restarts. | `ghostTripReset` calls in `backend-sync.ts` |
| Re-enabling the workflow through GitHub's API each day stops GitHub pausing it after 60 days. This is the common keepalive approach, not verified here. | "Keep the daily schedule alive" step in `multi-release.yml` |
| Upstream's versionCode keeps increasing, and no upstream version gets more than 99 fork releases. | `scripts/multi-release.js` |
| Obtainium matches the release tag `v1.7.1-multi.1` to the app's version `1.7.1-multi.1`. | Release tag format in `multi-release.yml` |
| A token refresh or trip check of the previous account rarely takes over 10 seconds, so a switch never needs to wait longer. | `SETTLE_TIMEOUT_MS` in `src/lib/accounts.ts` |
| Gira+ keeps its saved login under the `email` and `password` storage keys and reads them once at startup. If upstream changes that, opening on the main account quietly stops working, with no rebase conflict to warn about. | `chooseStartupAccount` in `src/lib/accounts.ts` |
| The "trip still running" memory is used for one start only. If the app restarts mid-ride while offline, the next start after that opens on the main account. | `chooseStartupAccount` in `src/lib/accounts.ts` |
| The labels use the same rules as Gira+ (a trip counts when `activeTripId` > 0; a pass counts while any usage hasn't expired). They're copied, not shared, because Gira+'s versions only work for the active account. | `hasRunningTrip` and `passState` in `src/lib/account-labels.ts`, `isUsageExpired` in `src/lib/account-snapshot.ts` |
| The pass and balance loaded before a switch follow Gira+'s `getAccountSnapshot` (in `gira-api/api.ts`), copied because Gira+'s version only works for the active session. If upstream changes that function, the copy needs the same change, or after a switch the header can show the pass differently from Gira+. | `snapshotFrom` in `src/lib/account-snapshot.ts` |
| Waiting up to 3 seconds for the new account's pass and balance is short enough not to feel slow, and long enough for a normal connection. | `SNAPSHOT_WAIT_MS` in `src/lib/accounts.ts` |
| Checking the other accounts at most every 3 minutes, only when a list is shown, is light enough for EMEL. How EMEL views several accounts checked from one phone is unknown. | `LABEL_MAX_AGE_MS` in `src/lib/account-labels.ts` |
| `allowBackup="false"` keeps saved passwords out of Google cloud backups. On Android 12+, a direct phone-to-phone transfer may still copy app data (not checked). | `android/app/src/main/AndroidManifest.xml` |

## Known limits

- The login screen still says "Welcome to Gira+".
- Nothing is reported to EMEL. A ghost trip stays on its account until EMEL closes it.
