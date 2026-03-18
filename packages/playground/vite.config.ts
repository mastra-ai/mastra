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
// Node-only npm packages imported by @mastra/core server-only code (e.g. sandbox).
// These are never called in the browser — stub them alongside Node builtins.
const nodeOnlyPackages = new Set(['execa']);

const stubNodeBuiltinsPlugin: Plugin = {
  name: 'stub-node-builtins',
  enforce: 'pre',
  resolveId(source) {
    if (nodeOnlyPackages.has(source)) {
      return { id: `\0node-stub:${source}`, moduleSideEffects: false };
    }
    const mod = source.startsWith('node:') ? source.slice(5) : source;
    const baseMod = mod.split('/')[0];
    if (builtinModules.includes(baseMod)) {
      return { id: `\0node-stub:${source}`, moduleSideEffects: false };
    }
  },
  load(id) {
    if (id.startsWith('\0node-stub:')) {
      // Build a Proxy-based stub where every property access returns a no-op
      // function (which itself returns a proxy for chaining like
      // `createRequire(url)('zod')`). During build Rollup uses
      // syntheticNamedExports; during dev Vite needs real ESM exports, so we
      // enumerate the known named imports from Node builtins used by
      // @mastra/core, schema-compat, and playground-ui.
      const source = id.slice('\0node-stub:'.length);
      const mod = source.startsWith('node:') ? source.slice(5) : source;
      const baseMod = mod.split('/')[0];

      const knownExports: Record<string, string[]> = {
        module: ['createRequire', 'builtinModules'],
        fs: [
          'constants', 'existsSync', 'mkdirSync', 'mkdtempSync', 'readFileSync',
          'readdirSync', 'realpathSync', 'renameSync', 'rmSync', 'statSync',
          'writeFileSync', 'createReadStream', 'createWriteStream',
        ],
        'fs/promises': ['mkdtemp', 'readFile', 'rm', 'writeFile', 'readdir', 'stat', 'mkdir'],
        path: ['dirname', 'join', 'normalize', 'parse', 'relative', 'resolve', 'sep', 'basename', 'extname'],
        crypto: ['createHash', 'createHmac', 'randomUUID', 'randomBytes'],
        stream: ['PassThrough', 'Readable', 'Transform', 'Writable', 'pipeline'],
        'stream/web': ['ReadableStream', 'WritableStream', 'TransformStream'],
        events: ['EventEmitter'],
        child_process: ['exec', 'execFile', 'execFileSync', 'spawn'],
        os: ['tmpdir', 'homedir', 'platform'],
        url: ['fileURLToPath', 'pathToFileURL', 'URL'],
        util: ['promisify', 'inspect'],
        http: ['ServerResponse', 'IncomingMessage', 'createServer'],
        https: ['createServer'],
        assert: ['fail', 'ok', 'strictEqual'],
        buffer: ['Buffer'],
        zlib: ['createGzip', 'createGunzip'],
        net: ['createServer', 'Socket'],
        tls: ['createServer'],
        querystring: ['parse', 'stringify'],
      };

      const names = knownExports[mod] ?? knownExports[baseMod] ?? [];
      const lines = [
        'const noop = () => stub;',
        'const stub = new Proxy(noop, { get: () => noop });',
        'export default stub;',
        ...names.map(n => `export const ${n} = noop;`),
      ];
      return lines.join('\n');
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
