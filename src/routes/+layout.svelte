<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	// This can be false if you're using a fallback (i.e. SPA mode)
	export const prerender = true;
	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children?.()}
