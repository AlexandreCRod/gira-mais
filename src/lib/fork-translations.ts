// Gira+ Multi: strings for the multi-account features, kept apart from upstream's translations so
// rebases don't conflict. Spread into the translations object in $lib/translations.
export const forkTranslations = {
	multi_accounts_title: {
		en: 'Accounts',
		pt: 'Contas',
	},
	multi_add_account: {
		en: 'Add account',
		pt: 'Adicionar conta',
	},
	multi_add_account_title: {
		en: 'Add an account',
		pt: 'Adicionar uma conta',
	},
	multi_active_label: {
		en: 'Active',
		pt: 'Ativa',
	},
	multi_switch_title: {
		en: 'Switch account',
		pt: 'Mudar de conta',
	},
	multi_switch_button: {
		en: 'Switch',
		pt: 'Mudar',
	},
	multi_active_trip_title: {
		en: 'This account already has a trip',
		pt: 'Esta conta já tem uma viagem',
	},
	multi_active_trip_message: {
		en: 'Unlock this bike with another account:',
		pt: 'Desbloquear esta bicicleta com outra conta:',
	},
	multi_trip_switch_warning: {
		en: 'Switching stops tracking the current trip in this app. The trip itself keeps running until the bike is docked.',
		pt: 'Ao mudar de conta, a viagem atual deixa de ser acompanhada nesta aplicação. A viagem continua até a bicicleta ser devolvida.',
	},
	multi_switch_invalid_credentials: {
		en: 'Couldn\'t log in to {{email}}: the password was rejected.',
		pt: 'Não foi possível entrar em {{email}}: a palavra-passe foi rejeitada.',
	},
	multi_switch_failed: {
		en: 'Couldn\'t switch account. Check your connection and try again.',
		pt: 'Não foi possível mudar de conta. Verifique a ligação e tente novamente.',
	},
	multi_remove_title: {
		en: 'Remove account?',
		pt: 'Remover conta?',
	},
	multi_remove_message: {
		en: '{{email}} will be removed from this phone. You can add it again later.',
		pt: '{{email}} será removida deste telemóvel. Pode adicioná-la novamente mais tarde.',
	},
	multi_remove_button: {
		en: 'Remove',
		pt: 'Remover',
	},
	multi_trip_button: {
		en: 'Not your trip? Switch account',
		pt: 'Não é a sua viagem? Mudar de conta',
	},
} as const;