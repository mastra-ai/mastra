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
    },
    build: {
      cssCodeSplit: false,
    },
    server: {
      fs: {
        allow: ['..'],
      },
    },
    define: {
      process: {},
    },
  };

  if (mode === 'development') {
    return {
      ...commonConfig,
      server: {
        ...commonConfig.server,
        proxy: {
          '/api': {
            target: 'http://localhost:4111',
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
