import { builtinModules } from 'node:module';
import path from 'node:path';
import react from '@vitejs/plugin-react';
import type { Plugin, PluginOption, UserConfig } from 'vite';
import { defineConfig } from 'vite';

const studioStandalonePlugin = (targetPort: string, targetHost: string): PluginOption => ({
  name: 'studio-standalone-plugin',
  transformIndexHtml(html: string) {
    return html
      .replace(/%%MASTRA_SERVER_HOST%%/g, targetHost)
      .replace(/%%MASTRA_SERVER_PORT%%/g, targetPort)
      .replace(/%%MASTRA_API_PREFIX%%/g, '/api')
      .replace(/%%MASTRA_HIDE_CLOUD_CTA%%/g, 'true')
      .replace(/%%MASTRA_STUDIO_BASE_PATH%%/g, '')
      .replace(/%%MASTRA_SERVER_PROTOCOL%%/g, 'http')
      .replace(/%%MASTRA_CLOUD_API_ENDPOINT%%/g, '')
      .replace(/%%MASTRA_EXPERIMENTAL_FEATURES%%/g, process.env.EXPERIMENTAL_FEATURES || 'false');
  },
});

// @mastra/core dist chunks contain Node.js builtins (stream, fs, crypto, etc.)
// from server-only code (voice, workspace tools) that shares chunks with
// browser-safe code. These code paths are never called in the browser —
// stub them so Rollup can resolve the imports without erroring.
// enforce: 'pre' ensures this runs before Vite's built-in vite:resolve which
// would otherwise replace them with __vite-browser-external (no named exports).
const stubNodeBuiltinsPlugin: Plugin = {
  name: 'stub-node-builtins',
  enforce: 'pre',
  apply: 'build',
  resolveId(source) {
    const mod = source.startsWith('node:') ? source.slice(5) : source;
    const baseMod = mod.split('/')[0];
    if (builtinModules.includes(baseMod)) {
      return { id: `\0node-stub:${source}`, moduleSideEffects: false };
    }
  },
  load(id) {
    if (id.startsWith('\0node-stub:')) {
      return { code: 'export default {}', syntheticNamedExports: true };
    }
  },
};

export default defineConfig(({ mode }) => {
  const commonConfig: UserConfig = {
    plugins: [stubNodeBuiltinsPlugin, react()],
    base: './',
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
      process: {
        env: {},
      },
    },
  };

  if (mode === 'development') {
    // Use environment variable for the target port, fallback to 4111
    const targetPort = process.env.PORT || '4111';
    const targetHost = process.env.HOST || 'localhost';

    if (commonConfig.plugins) {
      commonConfig.plugins.push(studioStandalonePlugin(targetPort, targetHost));
    }

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
