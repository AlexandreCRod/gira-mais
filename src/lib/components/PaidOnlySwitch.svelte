<script lang="ts">
	// Gira+ Multi: the "Paid only" switch next to the trips title
	import { t } from '$lib/translations';

	let { on = $bindable(false) }: { on?: boolean } = $props();
</script>

<button role="switch" aria-checked={on} class="flex items-center gap-1.5 text-2xs font-semibold text-label" onclick={() => on = !on}>
	{$t('multi_paid_only')}
	<span class="relative w-8 h-[18px] rounded-full transition-colors {on ? 'bg-primary' : 'bg-background-tertiary'}">
		<span class="absolute top-[2px] left-[2px] w-[14px] h-[14px] rounded-full bg-white transition-transform {on ? 'translate-x-[14px]' : ''}"></span>
	</span>
</button>