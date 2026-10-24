<script lang="ts">
	// Gira+ Multi: small tags under a saved account: trip running, pass expired or missing
	import { accountInfo } from '$lib/account';
	import { checkedLabels, labelKey, type PassState } from '$lib/account-labels';
	import { t } from '$lib/translations';
	import { currentTrip, DEBUG_TRIP_CODE } from '$lib/trip';

	let { email, active }: { email: string, active: boolean } = $props();

	const checked = $derived(active ? null : $checkedLabels[labelKey(email)] ?? null);
	const tripRunning = $derived(active ? $currentTrip !== null && $currentTrip.code !== DEBUG_TRIP_CODE && !$currentTrip.finished : checked?.tripRunning ?? false);
	const pass = $derived(active ? activePass() : checked?.pass ?? null);

	function activePass(): PassState | null {
		if ($accountInfo === null) return null;
		if ($accountInfo.subscription === null) return 'none';
		return $accountInfo.subscription.active ? 'valid' : 'expired';
	}
</script>

{#if tripRunning || pass === 'expired' || pass === 'none'}
	<div class="flex flex-wrap gap-1 mt-1">
		{#if tripRunning}
			<span class="text-[11px] font-bold text-warning border border-current rounded-full px-2">{$t('multi_trip_running_label')}</span>
		{/if}
		{#if pass === 'expired' || pass === 'none'}
			<span class="text-[11px] font-bold text-red-500 border border-current rounded-full px-2">{$t(pass === 'expired' ? 'multi_pass_expired_label' : 'multi_no_pass_label')}</span>
		{/if}
	</div>
{/if}