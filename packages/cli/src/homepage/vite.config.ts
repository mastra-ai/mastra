import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, '../shared'),
    },
  },
  optimizeDeps: {
    include: ['@tailwind-config'],
  },
  build: {
    cssCodeSplit: false,
    assetsDir: 'homepage-assets',
  },
  server: {
    fs: {
      allow: ['..'],
    },
  },
});
