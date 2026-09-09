import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		// adapter-node builds a plain Node server (build/index.js) that runs
		// in any container — this is what the Render Docker deploy runs.
		// It listens on process.env.PORT automatically (defaulting to 3000
		// locally), so nothing here hardcodes a port.
		adapter: adapter()
	}
};

export default config;
