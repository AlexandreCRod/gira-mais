<script lang="ts">
	// Gira+ Multi: the accounts on the profile page: the dots under the header, the empty profile past the last account
	// (to add one), and the questions that switching and the exit button ask. The header's own swipe is in
	// $lib/profile-accounts.
	import { userCredentials } from '$lib/account';
	import { knownSnapshot } from '$lib/account-snapshot';
	import { addAccount, mainAccount, otherAccounts, sameEmail, savedAccounts, signOutActive, switchAccount, switchingTo, tripInProgress, type SwitchResult } from '$lib/accounts';
	import Login from '$lib/components/Login.svelte';
	import MainCaption from '$lib/components/MainCaption.svelte';
	import Metric from '$lib/components/Metric.svelte';
	import { newAccountPage, pendingAccount, registerProfileAccounts, targetPage } from '$lib/profile-accounts';
	import { SIDEWAYS_COMMIT_PX, swipeSideways } from '$lib/swipe';
	import { getLocale, t } from '$lib/translations';
	import { enqueueDialog, errorMessages } from '$lib/ui.svelte';
	import IconPlus from '@tabler/icons-svelte/icons/plus';
	import IconTicket from '@tabler/icons-svelte/icons/ticket';
	import { onMount, type Snippet } from 'svelte';
	import { fade, fly } from 'svelte/transition';

	let { onclose }: { onclose: () => void } = $props();

	let adding = $state(false);
	let removing = $state('');
	let panelX = $state(0);
	let dragging = $state(false);

	// Copied from upstream's Profile.svelte, so the stand-in names the pass the way its header does
	const knownSubscriptionTypes = {
		'Passe Anual': 'annual_pass_label',
		'Passe Mensal': 'monthly_pass_label',
		'Passe Diário': 'daily_pass_label',
		'Passe Diario': 'daily_pass_label',
	} as const;
	const pending = $derived($pendingAccount?.snapshot ?? null);
	const pendingPass = $derived.by(() => {
		if (pending === null) return '—';
		const name = pending.subscription?.name ?? '';
		if (!name) return $t('no_subscription_label');
		return name in knownSubscriptionTypes ? $t(knownSubscriptionTypes[name as keyof typeof knownSubscriptionTypes]) : name;
	});

	// Upstream's header shows the first and last names only
	const shortName = (name: string) => name ? `${name.split(' ').shift()}${name.includes(' ') ? ` ${name.split(' ').pop()}` : ''}` : $t('user_label');
	const pendingIsMain = $derived($pendingAccount !== null && $mainAccount !== null && sameEmail($mainAccount, $pendingAccount.email));

	const isActive = (email: string) => $userCredentials != null && sameEmail(email, $userCredentials.email);
	// While a switch loads, the dots already show where it's going
	const current = $derived($newAccountPage ? $savedAccounts.length : $savedAccounts.findIndex(account => sameEmail(account.email, $switchingTo ?? $userCredentials?.email ?? '')));

	function showError(result: SwitchResult, email: string) {
		if (result === 'invalid-credentials') errorMessages.add($t('multi_switch_invalid_credentials', { email }), 5000);
		else if (result === 'failed') errorMessages.add($t('multi_switch_failed'), 5000);
	}

	// A question as a promise: true when confirmed, false when cancelled or dismissed by a tap outside it
	let answer: ((confirmed: boolean) => void) | null = null;
	function ask(snippet: Snippet<[dismiss: () => void]>) {
		return new Promise<boolean>(resolve => {
			answer = resolve;
			enqueueDialog(snippet);
		});
	}
	function reply(dismiss: () => void, confirmed: boolean) {
		const resolve = answer;
		answer = null;
		resolve?.(confirmed);
		dismiss();
	}
	function unanswered(_node: HTMLElement) {
		return { destroy: () => reply(() => {}, false) };
	}

	async function swipe(direction: 1 | -1) {
		if ($switchingTo !== null) return false;
		const accounts = $savedAccounts;
		const from = $newAccountPage ? accounts.length : accounts.findIndex(account => isActive(account.email));
		const target = targetPage(accounts.length, from, direction);
		if (target === null) return false;
		if (target === accounts.length) {
			newAccountPage.set(true);
			return true;
		}
		const { email, name } = accounts[target];
		if (isActive(email)) {
			newAccountPage.set(false);
			return true;
		}
		if (tripInProgress() && !await ask(confirmSwitch)) return false;
		const fromNew = $newAccountPage;
		newAccountPage.set(false);
		pendingAccount.set({ email, name, snapshot: knownSnapshot(email), direction });
		const result = await switchAccount(email);
		if (result !== 'ok') {
			showError(result, email);
			if (fromNew) newAccountPage.set(true);
		}
		pendingAccount.set(null);
		return result === 'ok';
	}

	async function signOut() {
		const email = $userCredentials?.email;
		if (email) {
			removing = email;
			if (!await ask(confirmRemove)) return;
		}
		const next = otherAccounts()[0]?.email;
		// With no other account it logs out, and the profile page has nothing to show once logged out
		if (!next) onclose();
		const result = await signOutActive();
		if (result !== 'ok') showError(result, next ?? email ?? '');
	}

	onMount(() => {
		const unregister = registerProfileAccounts({ swipe, signOut });
		return () => {
			unregister();
			newAccountPage.set(false);
			pendingAccount.set(null);
		};
	});

	async function onlogin(email: string, password: string) {
		const code = await addAccount(email, password);
		if (code === 0) {
			adding = false;
			newAccountPage.set(false);
		}
		return code;
	}
</script>

{#snippet confirmSwitch(dismiss: () => void)}
	<div use:unanswered class="w-[340px] max-w-md mx-auto p-6 bg-background rounded-2xl shadow-lg text-left flex flex-col gap-3">
		<h1 class="text-lg font-semibold text-info">{$t('multi_switch_title')}</h1>
		<div class="text-sm text-warning">{$t('multi_trip_switch_warning')}</div>
		<div class="flex justify-end gap-5 mt-1 font-bold">
			<button class="text-label" onclick={() => reply(dismiss, false)}>{$t('cancel_button')}</button>
			<button class="text-primary" onclick={() => reply(dismiss, true)}>{$t('multi_switch_button')}</button>
		</div>
	</div>
{/snippet}

{#snippet confirmRemove(dismiss: () => void)}
	<div use:unanswered class="w-[340px] max-w-md mx-auto p-6 bg-background rounded-2xl shadow-lg text-left flex flex-col gap-3">
		<h1 class="text-lg font-semibold text-info">{$t('multi_remove_title')}</h1>
		<div class="text-sm text-label">{$t('multi_remove_message', { email: removing })}</div>
		{#if tripInProgress()}
			<div class="text-sm text-warning">{$t('multi_trip_switch_warning')}</div>
		{/if}
		<div class="flex justify-end gap-5 mt-1 font-bold">
			<button class="text-label" onclick={() => reply(dismiss, false)}>{$t('cancel_button')}</button>
			<button class="text-warning" onclick={() => reply(dismiss, true)}>{$t('multi_remove_button')}</button>
		</div>
	</div>
{/snippet}

{#if $newAccountPage}
	<div in:fly={{ x: 100, duration: 180 }} class="flex flex-col justify-center items-center w-full gap-6 {dragging ? '' : 'transition-transform'}"
		style:transform={panelX ? `translateX(${panelX}px)` : null}
		use:swipeSideways={{
			move: dx => {
				dragging = true;
				// Only back towards the accounts: there's nothing past the empty profile
				panelX = Math.max(dx, 0);
			},
			end: dx => {
				dragging = false;
				panelX = 0;
				if (dx >= SIDEWAYS_COMMIT_PX) void swipe(-1);
			},
		}}
	>
		<div class="flex flex-col items-center">
			{#if $savedAccounts.length > 1}
				<div class="h-3.5"></div>
			{/if}
			<div class="font-bold text-label text-3xl text-center leading-none">{$t('multi_new_account_title')}</div>
			<div class="text-sm font-medium text-label">{$t('multi_new_account_subtext')}</div>
		</div>
		<button class="w-56 h-12 rounded-lg bg-primary text-background font-bold" onclick={() => adding = true}>{$t('multi_sign_in')}</button>
	</div>
{/if}

{#if $pendingAccount}
	<!-- Mirrors upstream's header, with the last known pass and balance, or "—" until they come -->
	<div in:fly={{ x: 100 * $pendingAccount.direction, duration: 180 }} class="flex flex-col justify-center items-center w-full gap-6">
		<div class="flex flex-col items-center">
			{#if $savedAccounts.length > 1}
				<div class="h-3.5">
					{#if pendingIsMain}
						<MainCaption />
					{/if}
				</div>
			{/if}
			<div class="font-bold text-primary text-3xl text-center leading-none">{shortName($pendingAccount.name)}</div>
			<div class="text-sm font-medium text-label">{$pendingAccount.email}</div>
		</div>
		<div class="flex items-center justify-center gap-12">
			<div class="flex flex-col items-center">
				<div class="flex items-center gap-1">
					<IconTicket size={28} stroke={1.9} class="text-info" />
					<div class="text-info font-bold text-lg">{pendingPass}</div>
				</div>
				{#if pending?.subscription?.expiresAt}
					<span class="text-2xs font-semibold text-label text-center leading-none">
						{$t('valid_until_label', { date: pending.subscription.expiresAt.toLocaleString(getLocale(), { day: 'numeric', month: 'long', year: 'numeric' }) }).toUpperCase()}
					</span>
				{/if}
			</div>
			<Metric value={pending?.balance?.toFixed(2) ?? '—'} unit={pending ? '€' : ''} label={$t('balance_label')} color={(pending?.balance ?? 0) < 0 ? 'warning' : 'info'} />
		</div>
	</div>
{/if}

<div class="flex items-center justify-center gap-1.5 -mt-6" aria-hidden="true">
	{#each $savedAccounts as account, index (account.email)}
		<span class="w-1.5 h-1.5 rounded-full transition-colors {index === current ? 'bg-primary' : 'bg-background-tertiary'}"></span>
	{/each}
	<IconPlus size={11} stroke={3} class="transition-colors {current === $savedAccounts.length ? 'text-primary' : 'text-background-tertiary'}" />
</div>

{#if adding}
	<div transition:fade={{ duration: 150 }} class="fixed inset-0 z-50 bg-background flex items-center justify-center">
		<Login title={$t('multi_add_account_title')} {onlogin} oncancel={() => adding = false} />
	</div>
{/if}