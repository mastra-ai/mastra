import { defineConfig, loadEnv } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const proxy = { '/vrq': { target: env.MASTRA_URL || 'http://127.0.0.1:4111', changeOrigin: true } };
  return { plugins: [svelte()], server: { proxy }, preview: { proxy } };
});
