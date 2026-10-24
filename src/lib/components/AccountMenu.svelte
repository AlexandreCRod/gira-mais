<script lang="ts">
	// Gira+ Multi: the saved accounts as a small menu under the map's profile button, to switch without opening the profile
	import { userCredentials } from '$lib/account';
	import { refreshAccountLabels } from '$lib/account-labels';
	import { accountMenu, closeAccountMenu } from '$lib/account-menu';
	import { sameEmail, savedAccounts, switchAccount, switchingTo, tripInProgress } from '$lib/accounts';
	import AccountLabels from '$lib/components/AccountLabels.svelte';
	import { t } from '$lib/translations';
	import { currentTrip } from '$lib/trip';
	import { errorMessages } from '$lib/ui.svelte';
	import { IconLoader2 } from '@tabler/icons-svelte';
	import IconAlertTriangle from '@tabler/icons-svelte/icons/alert-triangle';
	import IconCircleCheck from '@tabler/icons-svelte/icons/circle-check';
	import IconUserCircle from '@tabler/icons-svelte/icons/user-circle';
	import { fade, scale } from 'svelte/transition';

	const isActive = (email: string) => $userCredentials != null && sameEmail(email, $userCredentials.email);
	const warnAboutTrip = $derived($currentTrip !== null && tripInProgress());

	$effect(() => {
		if ($accountMenu) void refreshAccountLabels();
	});

	async function choose(email: string) {
		if ($switchingTo || isActive(email)) return;
		const result = await switchAccount(email);
		closeAccountMenu();
		if (result === 'invalid-credentials') errorMessages.add($t('multi_switch_invalid_credentials', { email }), 5000);
		else if (result === 'failed') errorMessages.add($t('multi_switch_failed'), 5000);
	}
</script>

{#if $accountMenu}
	<button transition:fade={{ duration: 150 }} class="fixed inset-0 z-40 cursor-default" aria-label={$t('multi_close_menu')} onclick={closeAccountMenu}></button>
	<div transition:scale={{ duration: 150, start: 0.95 }} class="fixed z-50 w-72 max-w-[calc(100vw-32px)] p-1 flex flex-col bg-background dark:bg-background-secondary rounded-2xl origin-top-right"
		style:top="{$accountMenu.top + 4}px" style:right="{$accountMenu.right}px" style:box-shadow="0px 0px 20px 0px var(--color-shadow)"
	>
		{#if warnAboutTrip}
			<div class="text-xs text-warning flex gap-2 px-3 pt-2 pb-1">
				<IconAlertTriangle size={16} stroke={2} class="shrink-0" />
				{$t('multi_trip_switch_warning')}
			</div>
		{/if}
		{#each $savedAccounts as account (account.email)}
			{@const active = isActive(account.email)}
			<button class="flex items-center gap-3 text-left px-3 py-2 rounded-xl transition-colors {active ? 'bg-background-secondary dark:bg-background-tertiary' : 'active:bg-background-secondary dark:active:bg-background-tertiary'}" disabled={$switchingTo !== null} onclick={() => choose(account.email)}>
				{#if $switchingTo === account.email}
					<IconLoader2 class="animate-spin text-primary shrink-0" size={24} />
				{:else if active}
					<IconCircleCheck class="text-primary shrink-0" size={24} stroke={2} />
				{:else}
					<IconUserCircle class="text-label shrink-0" size={24} stroke={1.75} />
				{/if}
				<div class="min-w-0">
					<div class="text-sm font-bold text-info truncate">{account.name}</div>
					{#if active}
						<div class="text-xs font-semibold text-label">{$t('multi_active_label')}</div>
					{/if}
					<AccountLabels email={account.email} {active} />
				</div>
			</button>
		{/each}
	</div>
{/if}