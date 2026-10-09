import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
const root = fileURLToPath(new URL('.', import.meta.url));
export default defineConfig({
  root,
  plugins: [react(), tailwindcss()],
  resolve: {
    dedupe: ['react', 'react-dom', '@tanstack/react-query'],
    alias: { '@nangohq/frontend': resolve(root, 'demo-platform-auth.ts') },
  },
  build: { outDir: resolve(root, '../preview-dist'), emptyOutDir: true },
  server: { host: '0.0.0.0', port: 4173, strictPort: true },
});
