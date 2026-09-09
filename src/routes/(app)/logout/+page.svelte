<script lang="ts">
	// Unreachable by GET — +page.server.ts's load() redirects away before this
	// ever renders. Exists only because SvelteKit requires a +page.svelte for
	// the route to host the logout form action.
</script>
