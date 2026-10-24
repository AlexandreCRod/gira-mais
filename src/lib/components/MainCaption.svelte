<script lang="ts">
	// Gira+ Multi: the small line above the main account's name
	import { t } from '$lib/translations';
	import { fade } from 'svelte/transition';
</script>

<div transition:fade={{ duration: 150 }} class="flex items-center gap-1 text-[10px] leading-none font-semibold uppercase tracking-wider text-label mb-1">
	<span class="w-1.5 h-1.5 rounded-full bg-primary"></span>
	{$t('multi_main_label')}
</div>