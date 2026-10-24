<script lang="ts">
	// Gira+ Multi: the cost under the bike number, only on trips that cost money
	import { formatTripCost } from '$lib/paid-trips';

	let { cost }: { cost: number | null } = $props();
</script>

{#if cost != null && cost > 0}
	<div class="text-2xs font-semibold text-label text-center leading-none mt-0.5">{formatTripCost(cost)}</div>
{/if}