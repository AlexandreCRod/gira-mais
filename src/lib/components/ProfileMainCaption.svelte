<script lang="ts">
	// Gira+ Multi: the "Main" caption above the profile page's name. With more than one account its line is always
	// kept, so the name doesn't jump as the header swipes between the main account and the others. It fades only when
	// the hold toggles it: keyed on the account, a switch swaps it at once, so the next account doesn't show the old
	// one's caption fading out, or the main one's fade in again after the stand-in already showed it.
	import { userCredentials } from '$lib/account';
	import { mainAccount, sameEmail, savedAccounts } from '$lib/accounts';
	import MainCaption from '$lib/components/MainCaption.svelte';

	const email = $derived($userCredentials?.email ?? null);
	const main = $derived($mainAccount !== null && email !== null && sameEmail($mainAccount, email));
</script>

{#if $savedAccounts.length > 1}
	<div class="h-3.5">
		{#key email}
			{#if main}
				<MainCaption />
			{/if}
		{/key}
	</div>
{/if}