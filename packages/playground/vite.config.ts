import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => {
  const commonConfig = {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    optimizeDeps: {
      include: ['@tailwind-config'],
      esbuildOptions: {
        define: {
          global: 'globalThis',
        },
      },
    },
    build: {
      cssCodeSplit: false,
      rollupOptions: {
        external: [
          '@mastra/core',
          'node:child_process',
          'node:path',
          'node:fs',
          'crypto',
          'events',
          'stream/web',
          'fs',
          'module',
          'os',
          'path',
          'fs/promises',
        ],
      },
    },
    server: {
      fs: {
        allow: ['..'],
      },
    },
    define: {
      global: 'globalThis',
      process: {
        env: {},
      },
    },
  };

  if (mode === 'development') {
    // Use environment variable for the target port, fallback to 4111
    const targetPort = process.env.PORT || '4111';
    const targetHost = process.env.HOST || 'localhost';

    return {
      ...commonConfig,
      server: {
        ...commonConfig.server,
        proxy: {
          '/api': {
            target: `http://${targetHost}:${targetPort}`,
            changeOrigin: true,
          },
        },
      },
    };
  }

  return {
    ...commonConfig,
  };
});
