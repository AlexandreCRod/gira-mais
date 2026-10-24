<script lang="ts">
	// Gira+ Multi: with "Paid only" on, the list can stay too short to scroll, and Gira+ only loads more trips on a
	// scroll. So this keeps loading older pages while the end of the list is in view, up to PAID_AUTO_PAGES at a time,
	// then offers to look further back.
	import { loadWhileInView, PAID_AUTO_PAGES } from '$lib/paid-trips';
	import { t } from '$lib/translations';
	import { safeInsets } from '$lib/ui.svelte';
	import { onMount } from 'svelte';

	let { load, done, found, paused = $bindable(false) }: { load: () => Promise<void>, done: boolean, found: number, paused?: boolean } = $props();

	let sentinel: HTMLDivElement | undefined = $state();
	let inView = false;
	let running = false;
	// Two frames, so the intersection observer has seen where the newly loaded trips pushed the end of the list
	const settle = () => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

	async function run() {
		if (running) return;
		running = true;
		paused = false;
		try {
			const pages = await loadWhileInView({ inView: () => inView, done: () => done, load, settle, limit: PAID_AUTO_PAGES });
			paused = pages === PAID_AUTO_PAGES && inView && !done;
		} finally {
			running = false;
		}
	}

	onMount(() => {
		const observer = new IntersectionObserver(entries => {
			inView = entries[0].isIntersecting;
			if (inView && !paused) void run();
		}, { rootMargin: '128px' });
		if (sentinel) observer.observe(sentinel);
		return () => observer.disconnect();
	});
</script>

<div bind:this={sentinel} class="flex flex-col items-center min-h-px px-5" style:padding-bottom={$safeInsets.bottom + 'px'}>
	{#if done && found === 0}
		<div class="text-2xl font-bold text-info">{$t('multi_no_paid_trips')}</div>
	{:else if paused}
		<button class="text-sm font-semibold text-primary mb-6" onclick={() => void run()}>{$t('multi_look_further_back')}</button>
	{/if}
</div>