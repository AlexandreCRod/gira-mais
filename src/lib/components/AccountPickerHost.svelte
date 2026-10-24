<script lang="ts">
	// Gira+ Multi: loads the saved accounts and shows the account picker when something asks for it
	import { accountPicker, initAccounts, type AccountPickerRequest } from '$lib/accounts';
	import AccountPicker from '$lib/components/AccountPicker.svelte';
	import { enqueueDialog } from '$lib/ui.svelte';
	import { onDestroy, onMount } from 'svelte';

	let request = $state<AccountPickerRequest | null>(null);

	onMount(() => {
		const tracking = initAccounts();
		return () => void tracking.then(stop => stop());
	});

	onDestroy(accountPicker.subscribe(next => {
		if (!next) return;
		request = next;
		accountPicker.set(null);
		enqueueDialog(picker);
	}));
</script>

{#snippet picker(dismiss: () => void)}
	{#if request}
		<AccountPicker {request} {dismiss} />
	{/if}
{/snippet}