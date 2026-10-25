<script lang="ts">
	// Gira+ Multi: the "Main" caption above the profile page's name. With more than one account its line is always
	// kept, so the name doesn't jump as the header swipes between the main account and the others.
	import { userCredentials } from '$lib/account';
	import { mainAccount, sameEmail, savedAccounts } from '$lib/accounts';
	import MainCaption from '$lib/components/MainCaption.svelte';

	const main = $derived($mainAccount !== null && $userCredentials != null && sameEmail($mainAccount, $userCredentials.email));
</script>

{#if $savedAccounts.length > 1}
	<div class="h-3.5">
		{#if main}
			<MainCaption />
		{/if}
	</div>
{/if}