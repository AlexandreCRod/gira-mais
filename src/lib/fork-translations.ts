// Gira+ Multi: strings for the multi-account features, kept apart from upstream's translations so
// rebases don't conflict. Spread into the translations object in $lib/translations.
export const forkTranslations = {
	multi_new_account_title: {
		en: 'New account',
		pt: 'Nova conta',
	},
	multi_new_account_subtext: {
		en: 'Add another Gira account',
		pt: 'Adicionar outra conta Gira',
	},
	multi_sign_in: {
		en: 'Sign in',
		pt: 'Iniciar sessão',
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
	multi_ghost_trip_title: {
		en: 'This trip looks stuck',
		pt: 'Esta viagem parece presa',
	},
	multi_ghost_trip_message: {
		en: 'The bike reports it\'s docked, but EMEL still shows this trip open. Unlock your next bike with another account:',
		pt: 'A bicicleta indica que está na doca, mas a EMEL ainda mostra esta viagem aberta. Desbloquear a próxima bicicleta com outra conta:',
	},
	multi_main_label: {
		en: 'Main',
		pt: 'Principal',
	},
	multi_trip_running_label: {
		en: 'Trip running',
		pt: 'Viagem a decorrer',
	},
	multi_pass_expired_label: {
		en: 'Pass expired',
		pt: 'Passe expirado',
	},
	multi_no_pass_label: {
		en: 'No pass',
		pt: 'Sem passe',
	},
	multi_not_now: {
		en: 'Not now',
		pt: 'Agora não',
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
	multi_close_menu: {
		en: 'Close',
		pt: 'Fechar',
	},
	multi_paid_only: {
		en: 'Paid only',
		pt: 'Só pagas',
	},
	multi_no_paid_trips: {
		en: 'No paid trips',
		pt: 'Sem viagens pagas',
	},
	multi_look_further_back: {
		en: 'Look further back',
		pt: 'Procurar mais atrás',
	},
	multi_trip_button: {
		en: 'Not your trip? Switch account',
		pt: 'Não é a sua viagem? Mudar de conta',
	},
} as const;