<script lang="ts">
	// Gira+ Multi: holding what this wraps (the map's profile button) opens the account menu; a tap still does what it did
	import { userCredentials } from '$lib/account';
	import { openAccountMenu } from '$lib/account-menu';
	import { otherAccounts, savedAccounts } from '$lib/accounts';
	import { hold } from '$lib/hold';
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();

	let node: HTMLDivElement | undefined = $state();
	const hasOtherAccounts = $derived(otherAccounts($savedAccounts, $userCredentials?.email ?? null).length > 0);
</script>

<div bind:this={node} class="select-none" style:-webkit-touch-callout="none" use:hold={() => { if (hasOtherAccounts && node) openAccountMenu(node); }}>
	{@render children()}
</div>