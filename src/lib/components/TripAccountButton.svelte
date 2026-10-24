<script lang="ts">
	// Gira+ Multi: during a trip, a way out when the trip isn't really yours (a ghost trip on this account)
	import { userCredentials } from '$lib/account';
	import { accountPicker, otherAccounts, savedAccounts } from '$lib/accounts';
	import { t } from '$lib/translations';
	import IconArrowsExchange from '@tabler/icons-svelte/icons/arrows-exchange';

	const hasOtherAccounts = $derived(otherAccounts($savedAccounts, $userCredentials?.email ?? null).length > 0);
</script>

{#if hasOtherAccounts}
	<button class="flex items-center gap-2 bg-background dark:bg-background-secondary rounded-full pl-3 pr-4 h-12 text-sm font-bold text-info active:bg-background-secondary dark:active:bg-background-tertiary transition-colors" style:filter="drop-shadow(0px 0px 20px var(--color-shadow))" onclick={() => accountPicker.set({ reason: 'switch' })}>
		<IconArrowsExchange class="text-primary shrink-0" size={24} stroke={2} />
		{$t('multi_trip_button')}
	</button>
{/if}