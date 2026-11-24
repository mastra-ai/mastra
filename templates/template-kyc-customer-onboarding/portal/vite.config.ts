import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const portalPort = Number(process.env.DEV_PORTAL_PORT ?? 5173);

export default defineConfig({
  plugins: [react()],
  server: {
    port: portalPort,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
  },
});
