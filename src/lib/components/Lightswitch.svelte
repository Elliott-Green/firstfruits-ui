<script lang="ts">
	import { appKit } from '$lib/appkit';

	let isDarkMode = $state(false);

	$effect(() => {
		// Trust whatever data-mode is already on <html> (set by app.html, or by
		// the inline script below from a stored preference) instead of
		// hardcoding a fallback here that can drift out of sync with it.
		const mode = document.documentElement.getAttribute('data-mode') === 'dark' ? 'dark' : 'light';
		isDarkMode = mode === 'dark';
		// AppKit's modal/button theme is always the opposite of the site's.
		appKit?.setThemeMode(mode === 'dark' ? 'light' : 'dark');
	});

	function toggleTheme() {
		const mode = isDarkMode ? 'light' : 'dark';
		document.documentElement.setAttribute('data-mode', mode);
		localStorage.setItem('mode', mode);
		isDarkMode = !isDarkMode;
		appKit?.setThemeMode(mode === 'dark' ? 'light' : 'dark');
	}
</script>

<svelte:head>
	<script>
		// Only override data-mode if the user has actually chosen a preference
		// before. Otherwise leave app.html's default alone — don't invent a
		// second fallback here that can disagree with it.
		const storedMode = localStorage.getItem('mode');
		if (storedMode) document.documentElement.setAttribute('data-mode', storedMode);
	</script>
</svelte:head>

<button
	type="button"
	class="btn-icon btn-lg preset-filled"
	title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
	aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
	onclick={toggleTheme}
>
	{#if !isDarkMode}
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="24"
			height="24"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
			class="lucide lucide-sun-icon lucide-sun"
			><circle cx="12" cy="12" r="4" /><path d="M12 2v2" /><path d="M12 20v2" /><path d="m4.93 4.93 1.41 1.41" /><path
				d="m17.66 17.66 1.41 1.41"
			/><path d="M2 12h2" /><path d="M20 12h2" /><path d="m6.34 17.66-1.41 1.41" /><path d="m19.07 4.93-1.41 1.41" /></svg
		>
	{:else}
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="24"
			height="24"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
			class="lucide lucide-moon-icon lucide-moon"
			><path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401" /></svg
		>
	{/if}
</button>
