import fs from 'node:fs/promises';
import { builtinModules } from 'node:module';
import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import ts from 'typescript';
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
      .replace(/%%MASTRA_AUTO_DETECT_URL%%/g, 'true')
      .replace(/%%MASTRA_EXPERIMENTAL_FEATURES%%/g, process.env.EXPERIMENTAL_FEATURES || 'false')
      .replace(/%%MASTRA_EXPERIMENTAL_UI%%/g, process.env.MASTRA_EXPERIMENTAL_UI || 'false')
      .replace(/%%MASTRA_AGENT_SIGNALS%%/g, process.env.MASTRA_AGENT_SIGNALS || 'false');
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
  apply: 'build',
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
      return { code: 'export default {}', syntheticNamedExports: true };
    }
  },
};

// @mastra/core dist top-level-imports server-only npm packages AND Node builtins from
// browser-reachable subpaths (telemetry, storage, fs). Vite externalizes Node builtins to a throwing
// proxy and can't browser-resolve the npm packages, so these imports crash at module eval before
// React renders. Every such usage is dead in the browser — the production build stubs them all to
// empty (stubNodeBuiltinsPlugin, apply:'build') and the app works — so empty no-op exports are safe.
// Dev serves native ESM, which ignores Rollup's syntheticNamedExports, so the stub must declare the
// exact named exports each module's importers use. Names below are the union imported across the
// linked @mastra dist; add to them if a new one surfaces. The real fix is in @mastra/core (make
// these server-only imports lazy / split them off any browser-reachable entry).

// npm package -> named exports the dev graph imports ([] = default only).
const browserStubPackages: Record<string, string[]> = {
  '@standard-schema/spec': [],
  'posthog-node': ['PostHog'],
  dotenv: ['config', 'parse'],
  ws: ['WebSocket'],
};

// Node builtin -> named exports the dev graph imports (default + namespace are always covered).
const nodeBuiltinStubExports: Record<string, string[]> = {
  crypto: ['createHash', 'randomUUID', 'randomBytes'],
  fs: ['existsSync', 'mkdirSync', 'readFileSync', 'writeFileSync', 'renameSync', 'statSync', 'readdirSync', 'rmSync', 'realpathSync', 'constants'],
  os: ['tmpdir'],
  path: ['join', 'dirname', 'resolve', 'sep', 'extname', 'relative', 'normalize', 'isAbsolute', 'basename', 'parse'],
  stream: ['Readable', 'Writable', 'Transform', 'PassThrough'],
  events: ['EventEmitter'],
  async_hooks: ['AsyncLocalStorage'],
  module: ['createRequire'],
  child_process: ['execFile', 'execFileSync'],
  url: ['fileURLToPath', 'pathToFileURL'],
};

// A stub module: a chainable no-op (callable, constructable, every property returns itself) exported
// as the default and under each requested name, so even a dead code path that runs cannot throw
// (e.g. createHash(x).update(y).digest(z)).
const stubModuleCode = (names: string[]) =>
  [
    'const s = new Proxy(function () {}, { get: () => s, apply: () => s, construct: () => s });',
    ...names.map(name => `export const ${name} = s;`),
    'export default s;',
  ].join('\n');

const stubBrowserPackagesPlugin: Plugin = {
  name: 'stub-browser-packages',
  enforce: 'pre',
  apply: 'serve',
  resolveId(source) {
    if (source in browserStubPackages) {
      return { id: `\0browser-stub:${source}`, moduleSideEffects: false };
    }
    const builtin = (source.startsWith('node:') ? source.slice(5) : source).split('/')[0];
    if (builtinModules.includes(builtin)) {
      return { id: `\0builtin-stub:${builtin}`, moduleSideEffects: false };
    }
  },
  load(id) {
    if (id.startsWith('\0browser-stub:')) {
      return stubModuleCode(browserStubPackages[id.slice('\0browser-stub:'.length)] ?? []);
    }
    if (id.startsWith('\0builtin-stub:')) {
      return stubModuleCode(nodeBuiltinStubExports[id.slice('\0builtin-stub:'.length)] ?? []);
    }
  },
};

const routesManifestPlugin = (): Plugin => {
  const getPropertyName = (name: ts.PropertyName) => {
    if (ts.isIdentifier(name) || ts.isStringLiteral(name)) {
      return name.text;
    }

    return undefined;
  };

  const collectRouteRoots = async (sourcePath: string) => {
    const sourceText = await fs.readFile(sourcePath, 'utf8');
    const sourceFile = ts.createSourceFile(sourcePath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const arraysByName = new Map<string, ts.Expression>();

    const visit = (node: ts.Node) => {
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
        arraysByName.set(node.name.text, node.initializer);
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);

    const collectedRoots = new Set<string>();
    const visitedArrayExpressions = new Set<ts.ArrayLiteralExpression>();

    const getRootSegment = (routePath: string) => {
      if (!routePath.startsWith('/')) {
        return undefined;
      }

      const normalizedPath = routePath.slice(1);
      const [rootSegment] = normalizedPath.split('/');
      return rootSegment || undefined;
    };

    const collectFromExpression = (expression: ts.Expression | undefined, inheritedRoot?: string) => {
      if (!expression) {
        return;
      }

      if (ts.isArrayLiteralExpression(expression)) {
        if (visitedArrayExpressions.has(expression)) {
          return;
        }

        visitedArrayExpressions.add(expression);

        for (const element of expression.elements) {
          collectFromArrayElement(element, inheritedRoot);
        }

        return;
      }

      if (ts.isIdentifier(expression)) {
        collectFromExpression(arraysByName.get(expression.text), inheritedRoot);
        return;
      }

      if (ts.isParenthesizedExpression(expression)) {
        collectFromExpression(expression.expression, inheritedRoot);
        return;
      }

      if (ts.isConditionalExpression(expression)) {
        collectFromExpression(expression.whenTrue, inheritedRoot);
        collectFromExpression(expression.whenFalse, inheritedRoot);
        return;
      }

      if (ts.isSpreadElement(expression)) {
        collectFromExpression(expression.expression, inheritedRoot);
      }
    };

    const collectFromArrayElement = (element: ts.Expression | ts.SpreadElement, inheritedRoot?: string) => {
      if (ts.isObjectLiteralExpression(element)) {
        collectFromObjectLiteral(element, inheritedRoot);
        return;
      }

      if (ts.isSpreadElement(element)) {
        collectFromExpression(element.expression, inheritedRoot);
        return;
      }

      if (ts.isConditionalExpression(element)) {
        collectFromExpression(element.whenTrue, inheritedRoot);
        collectFromExpression(element.whenFalse, inheritedRoot);
        return;
      }

      if (ts.isParenthesizedExpression(element)) {
        collectFromExpression(element.expression, inheritedRoot);
      }
    };

    const collectFromObjectLiteral = (objectLiteral: ts.ObjectLiteralExpression, inheritedRoot?: string) => {
      let routeRoot = inheritedRoot;

      for (const property of objectLiteral.properties) {
        if (!ts.isPropertyAssignment(property)) {
          continue;
        }

        const propertyName = getPropertyName(property.name);

        if (propertyName === 'path' && ts.isStringLiteralLike(property.initializer)) {
          routeRoot = getRootSegment(property.initializer.text) ?? inheritedRoot;

          if (routeRoot) {
            collectedRoots.add(routeRoot);
          }
        }
      }

      for (const property of objectLiteral.properties) {
        if (!ts.isPropertyAssignment(property)) {
          continue;
        }

        if (getPropertyName(property.name) === 'children') {
          collectFromExpression(property.initializer, routeRoot);
        }
      }
    };

    collectFromExpression(arraysByName.get('routes'));

    return [...collectedRoots].sort();
  };

  let resolvedConfig: { root: string; build: { outDir: string } } | undefined;

  return {
    name: 'routes-manifest',
    apply: 'build',
    configResolved(config) {
      resolvedConfig = config;
    },
    async writeBundle() {
      const root = resolvedConfig?.root ?? __dirname;
      const outDir = path.resolve(root, resolvedConfig?.build?.outDir ?? 'dist');
      const sourcePath = path.resolve(root, 'src', 'App.tsx');
      const outputPath = path.join(outDir, 'routes-manifest.json');
      const manifest = JSON.stringify(await collectRouteRoots(sourcePath), null, 2) + '\n';

      await fs.mkdir(outDir, { recursive: true });
      await fs.writeFile(outputPath, manifest, 'utf8');
    },
  };
};

export default defineConfig(({ mode }) => {
  const commonConfig: UserConfig = {
    plugins: [stubNodeBuiltinsPlugin, stubBrowserPackagesPlugin, tailwindcss(), react(), routesManifestPlugin()],
    base: './',
    resolve: {
      dedupe: ['react', 'react-dom', 'react/jsx-runtime', 'react-resizable-panels', '@tanstack/react-query'],
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@internal-temp': path.resolve(__dirname, './src/vendor/@mastra'),
      },
    },
    build: {
      cssCodeSplit: false,
    },
    optimizeDeps: {
      // esbuild can't run Vite plugins, so without exclude it pre-bundles these server-only/empty
      // packages into artifacts that crash at module-eval in the browser. Excluding them lets the
      // stub plugin above answer the bare imports instead.
      exclude: ['@standard-schema/spec', 'posthog-node', 'dotenv', 'ws'],
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
