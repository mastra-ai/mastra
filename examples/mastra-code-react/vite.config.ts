import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// The web client talks to the Mastra dev server (which serves the harness
// routes under /api) on :4111. Proxy /api so the browser can use same-origin
// requests and stream responses without CORS.
export default defineConfig({
  root: 'web',
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:4111',
        changeOrigin: true,
      },
    },
  },
});
