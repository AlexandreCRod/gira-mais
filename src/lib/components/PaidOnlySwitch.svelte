<script lang="ts">
	// Gira+ Multi: the "Paid only" switch next to the trips title
	import { t } from '$lib/translations';

	let { on = $bindable(false) }: { on?: boolean } = $props();
</script>

<button role="switch" aria-checked={on} class="flex items-center gap-2 text-sm font-semibold text-info" onclick={() => on = !on}>
	{$t('multi_paid_only')}
	<span class="relative w-11 h-[26px] rounded-full transition-colors {on ? 'bg-primary' : 'bg-background-tertiary'}">
		<span class="absolute top-[3px] left-[3px] w-5 h-5 rounded-full bg-white transition-transform {on ? 'translate-x-[18px]' : ''}"></span>
	</span>
</button>