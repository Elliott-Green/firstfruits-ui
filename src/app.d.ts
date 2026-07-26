// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}

	// Reown AppKit renders as custom elements; Svelte's type checker needs
	// these declared or it rejects the unknown tags.
	namespace svelteHTML {
		interface IntrinsicElements {
			'appkit-button': {
				disabled?: boolean;
				balance?: 'show' | 'hide';
				size?: 'md' | 'sm';
				label?: string;
				loadingLabel?: string;
			};
			'appkit-network-button': {
				disabled?: boolean;
			};
			'spline-viewer': {
				url?: string;
				'loading-anim-type'?: string;
				class?: string;
			};
		}
	}
}

export {};
