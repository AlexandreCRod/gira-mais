<script lang="ts">
	// Gira+ Multi: the saved accounts in the profile page, to switch between, add and remove
	import { userCredentials } from '$lib/account';
	import { addAccount, otherAccounts, removeAccount, sameEmail, savedAccounts, switchAccount, switchingTo, tripInProgress, type SwitchResult } from '$lib/accounts';
	import Login from '$lib/components/Login.svelte';
	import { t } from '$lib/translations';
	import { enqueueDialog, errorMessages } from '$lib/ui.svelte';
	import { IconLoader2 } from '@tabler/icons-svelte';
	import IconCircleCheck from '@tabler/icons-svelte/icons/circle-check';
	import IconTrash from '@tabler/icons-svelte/icons/trash';
	import IconUserCircle from '@tabler/icons-svelte/icons/user-circle';
	import IconUserPlus from '@tabler/icons-svelte/icons/user-plus';
	import { fade } from 'svelte/transition';

	let { onclose }: { onclose: () => void } = $props();

	let adding = $state(false);
	let pendingEmail = $state('');

	const isActive = (email: string) => $userCredentials != null && sameEmail(email, $userCredentials.email);

	function showError(result: SwitchResult, email: string) {
		if (result === 'invalid-credentials') errorMessages.add($t('multi_switch_invalid_credentials', { email }), 5000);
		else if (result === 'failed') errorMessages.add($t('multi_switch_failed'), 5000);
	}

	async function doSwitch(email: string) {
		showError(await switchAccount(email), email);
	}

	function requestSwitch(email: string) {
		if ($switchingTo || isActive(email)) return;
		if (tripInProgress()) {
			pendingEmail = email;
			enqueueDialog(confirmSwitch);
		} else {
			void doSwitch(email);
		}
	}

	async function doRemove(email: string) {
		// Removing the active account switches to the next one, which is the one that can fail
		const next = isActive(email) ? otherAccounts()[0]?.email : undefined;
		// Without a next one it logs out, and the profile page has nothing to show once logged out
		if (isActive(email) && !next) onclose();
		showError(await removeAccount(email), next ?? email);
	}

	function requestRemove(email: string) {
		pendingEmail = email;
		enqueueDialog(confirmRemove);
	}

	async function onlogin(email: string, password: string) {
		const code = await addAccount(email, password);
		if (code === 0) adding = false;
		return code;
	}
</script>

{#snippet confirmSwitch(dismiss: () => void)}
	<div class="w-[340px] max-w-md mx-auto p-6 bg-background rounded-2xl shadow-lg text-left flex flex-col gap-3">
		<h1 class="text-lg font-semibold text-info">{$t('multi_switch_title')}</h1>
		<div class="text-sm text-warning">{$t('multi_trip_switch_warning')}</div>
		<div class="flex justify-end gap-5 mt-1 font-bold">
			<button class="text-label" onclick={dismiss}>{$t('cancel_button')}</button>
			<button class="text-primary" onclick={() => { dismiss(); void doSwitch(pendingEmail); }}>{$t('multi_switch_button')}</button>
		</div>
	</div>
{/snippet}

{#snippet confirmRemove(dismiss: () => void)}
	<div class="w-[340px] max-w-md mx-auto p-6 bg-background rounded-2xl shadow-lg text-left flex flex-col gap-3">
		<h1 class="text-lg font-semibold text-info">{$t('multi_remove_title')}</h1>
		<div class="text-sm text-label">{$t('multi_remove_message', { email: pendingEmail })}</div>
		{#if isActive(pendingEmail) && tripInProgress()}
			<div class="text-sm text-warning">{$t('multi_trip_switch_warning')}</div>
		{/if}
		<div class="flex justify-end gap-5 mt-1 font-bold">
			<button class="text-label" onclick={dismiss}>{$t('cancel_button')}</button>
			<button class="text-warning" onclick={() => { dismiss(); void doRemove(pendingEmail); }}>{$t('multi_remove_button')}</button>
		</div>
	</div>
{/snippet}

<div class="flex flex-col gap-2 w-full px-2">
	<div class="text-xs font-bold text-label uppercase tracking-wide px-1">{$t('multi_accounts_title')}</div>
	{#each $savedAccounts as account (account.email)}
		{@const active = isActive(account.email)}
		<div class="flex items-center rounded-2xl bg-background dark:bg-background-secondary" style:box-shadow="0px 0px 12px 0px var(--color-shadow)">
			<button class="flex items-center gap-3 grow min-w-0 text-left px-3 py-2 rounded-2xl active:bg-background-secondary dark:active:bg-background-tertiary transition-colors" disabled={active || $switchingTo !== null} onclick={() => requestSwitch(account.email)}>
				{#if $switchingTo === account.email}
					<IconLoader2 class="animate-spin text-primary shrink-0" size={28} />
				{:else if active}
					<IconCircleCheck class="text-primary shrink-0" size={28} stroke={2} />
				{:else}
					<IconUserCircle class="text-label shrink-0" size={28} stroke={1.75} />
				{/if}
				<div class="min-w-0">
					<div class="font-bold text-info truncate">{account.name}</div>
					<div class="text-xs font-semibold text-label truncate">{active ? `${$t('multi_active_label')} · ` : ''}{account.email}</div>
				</div>
			</button>
			<button class="p-3 text-label active:text-warning transition-colors" aria-label={$t('multi_remove_button')} disabled={$switchingTo !== null} onclick={() => requestRemove(account.email)}>
				<IconTrash size={20} stroke={1.75} />
			</button>
		</div>
	{/each}
	<button class="flex items-center gap-2 justify-center font-bold text-primary py-2" disabled={$switchingTo !== null} onclick={() => adding = true}>
		<IconUserPlus size={22} stroke={2} />
		{$t('multi_add_account')}
	</button>
</div>

{#if adding}
	<div transition:fade={{ duration: 150 }} class="fixed inset-0 z-50 bg-background flex items-center justify-center">
		<Login title={$t('multi_add_account_title')} {onlogin} oncancel={() => adding = false} />
	</div>
{/if}