import { browser } from '$app/environment';
import { appKit } from '$lib/appkit';

type AccountState = {
	address: string | undefined;
	isConnected: boolean;
};

// A module-level $state export must never be reassigned (only mutated) —
// Svelte's compiler forbids `export let x = $state(...); x = y` elsewhere in
// the module. Keep one stable object and update its fields in place instead.
export const account = $state<AccountState>({ address: undefined, isConnected: false });

function applyAccount(next: { address?: string; isConnected?: boolean } | undefined) {
	account.address = next?.address;
	account.isConnected = next?.isConnected ?? false;
}

if (browser && appKit) {
	applyAccount(appKit.getAccount());
	appKit.subscribeAccount(applyAccount);
}

export function openConnectModal() {
	appKit?.open();
}
