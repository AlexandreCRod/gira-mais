<script lang="ts">
	// Gira+ Multi: pick another saved account, either to switch to it or to retry an unlock this account was refused
	import { userCredentials } from '$lib/account';
	import { otherAccounts, savedAccounts, switchAccount, switchingTo, tripInProgress, type AccountPickerRequest } from '$lib/accounts';
	import { t } from '$lib/translations';
	import { currentTrip } from '$lib/trip';
	import { IconLoader2 } from '@tabler/icons-svelte';
	import IconAlertTriangle from '@tabler/icons-svelte/icons/alert-triangle';
	import IconUserCircle from '@tabler/icons-svelte/icons/user-circle';
	import IconX from '@tabler/icons-svelte/icons/x';

	let { request, dismiss }: { request: AccountPickerRequest, dismiss: () => void } = $props();

	const titles = {
		'switch': 'multi_switch_title',
		'active-trip': 'multi_active_trip_title',
		'ghost-trip': 'multi_ghost_trip_title',
	} as const;

	const accounts = $derived(otherAccounts($savedAccounts, $userCredentials?.email ?? null));
	const warnAboutTrip = $derived(request.reason === 'switch' && $currentTrip !== null && tripInProgress());
	let error = $state('');

	async function choose(email: string) {
		error = '';
		const result = await switchAccount(email);
		if (result === 'ok') {
			dismiss();
			await request.retry?.();
		} else {
			error = result === 'invalid-credentials' ? $t('multi_switch_invalid_credentials', { email }) : $t('multi_switch_failed');
		}
	}
</script>

<div class="w-[340px] max-w-md mx-auto p-6 bg-background rounded-2xl shadow-lg text-left flex flex-col gap-3">
	<div class="flex justify-between items-start gap-3">
		<h1 class="text-lg font-semibold text-info">{$t(titles[request.reason])}</h1>
		<IconX class="text-label hover:text-primary cursor-pointer shrink-0" size="24" stroke="1.5" onclick={dismiss} aria-label="Close dialog" />
	</div>
	{#if request.reason === 'active-trip'}
		<div class="text-sm text-label">{$t('multi_active_trip_message')}</div>
	{:else if request.reason === 'ghost-trip'}
		<div class="text-sm text-label">{$t('multi_ghost_trip_message')}</div>
	{/if}
	{#if warnAboutTrip}
		<div class="text-sm text-warning flex gap-2">
			<IconAlertTriangle size="20" stroke="2" class="shrink-0" />
			{$t('multi_trip_switch_warning')}
		</div>
	{/if}
	<div class="flex flex-col gap-2">
		{#each accounts as account (account.email)}
			<button class="flex items-center text-left gap-3 rounded-xl px-3 py-2 bg-background-secondary active:bg-background-tertiary transition-colors disabled:opacity-60" disabled={$switchingTo !== null} onclick={() => choose(account.email)}>
				{#if $switchingTo === account.email}
					<IconLoader2 class="animate-spin text-primary shrink-0" size={28} />
				{:else}
					<IconUserCircle class="text-primary shrink-0" size={28} stroke={1.75} />
				{/if}
				<div class="min-w-0">
					<div class="font-bold text-info truncate">{account.name}</div>
					{#if account.name !== account.email}
						<div class="text-xs font-semibold text-label truncate">{account.email}</div>
					{/if}
				</div>
			</button>
		{/each}
	</div>
	{#if error}
		<div class="text-sm text-red-500">{error}</div>
	{/if}
	<div class="flex justify-end gap-5 mt-1 font-bold">
		<button class="text-label" onclick={dismiss}>{$t(request.reason === 'ghost-trip' ? 'multi_not_now' : 'cancel_button')}</button>
	</div>
</div>