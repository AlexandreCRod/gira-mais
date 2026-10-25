# Gira+ Multi

A personal fork of [Gira+](https://github.com/rt-evil-inc/gira-mais) that keeps several EMEL accounts saved in the app and switches between them without logging out. The main use is ghost trips: a trip that stays open after the bike is docked blocks that account from unlocking, and another account gets you riding again. Android only.

It installs next to Gira+ (own app id) and follows upstream's releases: each release here is the latest Gira+ release plus the changes below.

## Install

Download the APK from [Releases](../../releases), or add this repository's URL to [Obtainium](https://github.com/ImranR98/Obtainium) to get updates automatically.

## What changes compared to Gira+

- **Saved accounts.** On the profile page, swiping the top part (name, pass, balance) sideways switches to the previous or next saved account; dots under it show where you are. While a swipe's switch loads, the next account's name and email slide in straight away, with its last known pass and balance (from the map menu's check, or from when you last left that account), or "—" if the app hasn't seen them. Past the last account comes an empty "New account" profile whose "Sign in" button opens the login screen to add one. "Exit" asks before removing the account on screen, then moves on to the next saved account (or logs out after the last one). A switch reuses the account's last session while it's still valid, falls back to a full login, and leaves everything as it was unless the new session is ready.
- **Unlock fallback.** When VAIMOO refuses an unlock because the account already has a trip (error 1607), the app offers the other saved accounts and retries the same bike with the one picked.
- **Trip screen.** During a trip, a button offers the same switch, with a warning that the trip stops being tracked in the app.
- **Ghost-trip offer.** It uses Gira+'s own trip-end signal: the bike document says `LOCKED` with no trip id, and Gira+ then checks with VAIMOO. If VAIMOO still shows the trip open 2 minutes later on Gira+'s regular polls, the account picker opens once with "This trip looks stuck" and a "Not now" button. It makes no extra requests and reports nothing.
- **Main account.** Pressing and holding the top of the profile page makes the account on screen the one the app opens on, marked by a small "Main" line above its name. Holding it again turns this off. At startup, before Gira+ logs in, the fork points Gira+'s saved login at that account. Gira+ still logs in once, so opening is no slower and nothing switches afterwards. If a trip on another account was still running when the app closed (its bike not yet docked), that start opens on that account instead.
- **Quick switch from the map.** A short swipe down from the map's profile button opens a small menu under it, as wide as the longest name, with the saved accounts and their labels; tapping one switches, with the same trip warning as the profile page. A tap still opens the profile, and back or a single tap outside closes the menu. Only with two or more accounts.
- **Account labels.** "Trip running", and "Pass expired" or "No pass" appear under each account in the map menu and in the switch popups. The active account's labels come from what the app already knows. Each other account is checked when a list is shown, at most once every 3 minutes, using the same four requests Gira+ makes for the active account: session refresh, current trip, pass and balance. In the map menu, an account's icon turns orange (the orange Gira+'s profile button uses for a negative balance) when it can't start a trip: no valid pass, or a negative balance.
- **Safe switching.** A switch first waits (up to 10 seconds) for a token refresh or trip check of the previous account that's already under way. Otherwise that request could land after the switch and put the previous account back.
- **Smooth switch.** The new account's pass and balance are loaded during the switch, with the same two requests Gira+ makes for the active account, so the profile header shows them together with the name instead of a "—" first. The header then slides in. If that load fails or takes over 3 seconds, the switch goes ahead and Gira+'s own refresh fills them in as before. When the app has seen that account's pass and balance in the last 3 minutes, it doesn't wait: it shows those and lets Gira+'s own refresh bring them up to date, as after a login, so the same requests go out in a different order.
- **Paid trips in the history.** Trips that cost money show their cost in small grey under the bike number; free trips look as before. A "Paid only" switch next to the title hides the free ones. Gira+ loads the history 15 trips at a time as you scroll, so with the switch on the app keeps loading older pages while the end of the list is in view, up to 10 pages (150 trips) at a time, then shows a "Look further back" button. These are the same requests Gira+ makes on a scroll.
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
| `src/lib/profile-accounts.ts` | The profile page's account swipe, the empty "New account" page, and hold for main |
| `src/lib/account-menu.ts` | Where the map's account menu opens, and closing it |
| `src/lib/paid-trips.ts` | What counts as a paid trip, the cost format, and the auto-loading loop |
| `src/lib/fork.ts` | Release URLs and version ordering for this fork |
| `src/lib/fork-translations.ts` | The fork's own strings (pt/en) |
| `src/lib/components/AccountPicker.svelte`, `AccountPickerHost.svelte`, `ProfileAccounts.svelte`, `ProfileMainCaption.svelte`, `AccountLabels.svelte`, `MainCaption.svelte`, `TripAccountButton.svelte`, `TripCost.svelte`, `PaidOnlySwitch.svelte`, `PaidTripsLoader.svelte`, `AccountSwipe.svelte`, `AccountMenu.svelte`, `src/lib/swipe.ts` (swipe down and sideways), and `src/lib/hold.ts` (press and hold) | The account UI |
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
| `src/lib/components/Profile.svelte` | `use:profileHeader` on the header, the "Main" caption above the name, `ProfileAccounts` (dots, empty profile, questions) under the header, and the exit button asking before removing the account (hidden on the empty profile) |
| `src/lib/components/settings/History.svelte` | "Paid only" switch next to the title, the filter on the list, the auto-loader, and hiding the loading bikes while it waits for "Look further back" |
| `src/lib/components/settings/HistoryItem.svelte` | The cost under the bike number |
| `src/lib/components/InfoDialog.svelte` | Update check uses `src/lib/fork.ts` |
| `src/routes/+page.svelte` | Trip-screen button, the account picker host, the account menu (wrapping the profile button in `AccountSwipe`, and the back button closing the menu first) |
| `src/lib/translations.ts` | Merges the fork's strings |
| `README.md`, top | The notice that this is a modified, unofficial fork (GPL v3 asks for a dated "modified" notice) |
| `src/lib/settings.ts` | Analytics off by default |
| `capacitor.config.json`, `android/app/build.gradle`, `android/app/src/main/res/values/strings.xml`, `scripts/build.js` | App id and name |
| `android/app/src/main/AndroidManifest.xml` | Backups off |
| `src/app.css` | The map credits' info button stays in the bottom-left corner as in Gira+; open, the credits grow up and to the right from it and wrap 8px before the location button instead of covering it. Not fork-specific: offered to Gira+ as its own change. If Gira+ takes it as is, the rebase drops this commit by itself. |

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
- Paid trips in the history: the cost on paid trips and a "Paid only" switch.
- Larger "Paid only" switch; quick switch by holding the map's profile button; the map credits strip no longer covers the location button.
- The quick switch opens with a swipe down instead of a hold, and its menu fits the names; the credits' info button lines up with the location button and stays put when the credits close.
- The account list leaves the profile page: the profile's top part swipes between accounts, with an empty profile at the end to add one, hold for main, and "Exit" asking before removing. The credits' info button is back in the corner and the open credits grow from it. The map's account menu closes with one tap outside, and that tap no longer reaches the map underneath. On a profile swipe the next account's name slides in at once. In the map menu, an orange icon marks an account that can't start a trip (no valid pass or a negative balance); the background check now also asks for each account's balance. The README says this is a modified, unofficial fork. Profile switches show the last known pass and balance at once and skip the wait when those are under 3 minutes old.

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
| A 30 px swipe, mostly downwards, is long enough not to fire on a sloppy tap and short enough to do with a thumb on the profile button. | `SWIPE_PX` in `src/lib/swipe.ts` |
| A 60 px sideways drag on the profile's top part is a deliberate swipe; shorter ones spring back. The edges of the screen stay free for Android's back gesture because only the top part listens. | `SIDEWAYS_COMMIT_PX` in `src/lib/swipe.ts` |
| Waiting up to 3 seconds for the new account's pass and balance is short enough not to feel slow, and long enough for a normal connection. | `SNAPSHOT_WAIT_MS` in `src/lib/accounts.ts` |
| Checking the other accounts at most every 3 minutes, only when the map menu or a switch popup is shown, is light enough for EMEL. How EMEL views several accounts checked from one phone is unknown. | `LABEL_MAX_AGE_MS` in `src/lib/account-labels.ts` |
| A negative balance or a pass that isn't valid stops an account from starting a trip, so its icon in the map menu turns orange. EMEL's exact rule isn't known; Gira+ itself only colours its profile button (orange for a negative balance, grey without a pass). | `blockedForTrip` in `src/lib/account-labels.ts` |
| A pass and balance seen in the last 3 minutes are close enough to show during a switch while Gira+'s refresh fetches the current ones. | `SNAPSHOT_REUSE_MS` in `src/lib/accounts.ts` |
| The profile's stand-in names the pass and its expiry date the way upstream's header does (copied from `Profile.svelte`). If upstream changes that wording, the stand-in shows the old wording for the second it's on screen. | `knownSubscriptionTypes` in `src/lib/components/ProfileAccounts.svelte` |
| A trip is paid when VAIMOO's `tripCost` is above zero, and that cost is in euros (like the balance). Not checked against a real paid trip yet. | `isPaidTrip` and `formatTripCost` in `src/lib/paid-trips.ts` |
| With "Paid only" on, loading up to 10 pages (150 trips) by itself before asking is light enough for EMEL and enough to find recent paid trips. | `PAID_AUTO_PAGES` in `src/lib/paid-trips.ts` |
| `allowBackup="false"` keeps saved passwords out of Google cloud backups. On Android 12+, a direct phone-to-phone transfer may still copy app data (not checked). | `android/app/src/main/AndroidManifest.xml` |

## Known limits

- The login screen still says "Welcome to Gira+".
- Nothing is reported to EMEL. A ghost trip stays on its account until EMEL closes it.
