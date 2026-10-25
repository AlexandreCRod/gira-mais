<script lang="ts">
	// Gira+ Multi: swiping down from what this wraps (the map's profile button) opens the account menu; a tap still does
	// what it did
	import { userCredentials } from '$lib/account';
	import { openAccountMenu } from '$lib/account-menu';
	import { otherAccounts, savedAccounts } from '$lib/accounts';
	import { swipeDown } from '$lib/swipe';
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();

	let node: HTMLDivElement | undefined = $state();
	const hasOtherAccounts = $derived(otherAccounts($savedAccounts, $userCredentials?.email ?? null).length > 0);
</script>

<div bind:this={node} use:swipeDown={() => { if (hasOtherAccounts && node) openAccountMenu(node); }}>
	{@render children()}
</div>