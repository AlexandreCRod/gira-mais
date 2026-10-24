# Gira+ Multi

A personal fork of [Gira+](https://github.com/rt-evil-inc/gira-mais) that keeps several EMEL accounts saved in the app and switches between them without logging out. The main use is ghost trips: a trip that stays open after the bike is docked blocks that account from unlocking, and another account gets you riding again. Android only.

It installs next to Gira+ (own app id) and follows upstream's releases: each release here is the latest Gira+ release plus the changes below.

## Install

Download the APK from [Releases](../../releases), or add this repository's URL to [Obtainium](https://github.com/ImranR98/Obtainium) to get updates automatically.

## What changes compared to Gira+

- **Saved accounts.** Accounts are added and switched from the profile page. A switch reuses the account's last session while it's still valid, falls back to a full login, and leaves everything as it was unless the new session is ready.
- **Unlock fallback.** When VAIMOO refuses an unlock because the account already has a trip (error 1607), the app offers the other saved accounts and retries the same bike with the one picked.
- **Trip screen.** During a trip, a button offers the same switch, with a warning that the trip stops being tracked in the app.
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
| `src/lib/fork.ts` | Release URLs and version ordering for this fork |
| `src/lib/fork-translations.ts` | The fork's own strings (pt/en) |
| `src/lib/components/AccountPicker.svelte`, `AccountPickerHost.svelte`, `AccountSwitcher.svelte`, `TripAccountButton.svelte` | The account UI |
| `scripts/multi-release.js` | Stamps the release version at build time |
| `.github/workflows/multi-release.yml` | Rebases onto new upstream releases and publishes signed APKs |

Upstream files only get small hooks:

| File | Change |
| --- | --- |
| `src/lib/trip.ts` | On error 1607, offer the other accounts before showing the error |
| `src/lib/components/Login.svelte` | Autofill hints; optional title and login handler for the add-account screen |
| `src/lib/components/Profile.svelte` | Account switcher; sign-out goes through the saved accounts |
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

## Guesses and assumptions

These things were decided without confirmation from EMEL, VAIMOO or Gira+. Each entry says where to change it if it turns out wrong.

| Guess | Where to change it |
| --- | --- |
| VAIMOO error 1607 means "this account already has a trip". Taken from the official app's error list. | `ACTIVE_TRIP_ERROR_CODE` in `src/lib/unlock-fallback.ts` |
| Re-enabling the workflow through GitHub's API each day stops GitHub pausing it after 60 days. This is the common keepalive approach, not verified here. | "Keep the daily schedule alive" step in `multi-release.yml` |
| Upstream's versionCode keeps increasing, and no upstream version gets more than 99 fork releases. | `scripts/multi-release.js` |
| Obtainium matches the release tag `v1.7.1-multi.1` to the app's version `1.7.1-multi.1`. | Release tag format in `multi-release.yml` |
| `allowBackup="false"` keeps saved passwords out of Google cloud backups. On Android 12+, a direct phone-to-phone transfer may still copy app data (not checked). | `android/app/src/main/AndroidManifest.xml` |

## Known limits

- If a background token refresh lands at the exact moment of a switch, the app can end up on the previous account's session. Switching again fixes it.
- The login screen still says "Welcome to Gira+".
- Nothing is reported to EMEL. A ghost trip stays on its account until EMEL closes it.
