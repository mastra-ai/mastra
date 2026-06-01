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

// In dev, @mastra/core's dist top-level-imports server-only npm packages (posthog-node, dotenv, ws,
// @standard-schema/spec) and Node builtins (crypto, fs, stream, ...) from browser-reachable subpaths.
// Vite externalizes builtins to a throwing proxy and can't browser-resolve the npm packages, so these
// imports crash at module-eval before React renders. Every such usage is dead code in the browser.
// Dev serves native ESM, which ignores the build plugin's Rollup syntheticNamedExports, so the stub
// must expose the exact named exports each importer uses:
//   - Node builtins: derived from the real module's own exports (load() below), so ANY named import
//     resolves — no hand-maintained list to drift as @mastra/core evolves.
//   - npm packages: listed explicitly (a browser can't resolve them to enumerate their exports).
// The real fix is in @mastra/core: make these server-only imports lazy / off any browser-reachable entry.

// npm package -> named exports the dev graph imports ([] = default only). Exported for the regression test.
export const browserStubPackages: Record<string, string[]> = {
  '@standard-schema/spec': [],
  'posthog-node': ['PostHog'],
  dotenv: ['config', 'parse'],
  ws: ['WebSocket'],
};

// A stub module: a chainable no-op (callable, constructable, every property returns itself) exported
// as the default and under each name, so even a dead code path that runs cannot throw
// (e.g. createHash(x).update(y).digest(z)). `names` must be valid identifiers.
const stubModuleCode = (names: string[]) =>
  [
    'const __stub = new Proxy(function () {}, { get: () => __stub, apply: () => __stub, construct: () => __stub });',
    ...names.map(name => `export const ${name} = __stub;`),
    'export default __stub;',
  ].join('\n');

// Real named exports of a Node builtin specifier (e.g. 'stream/web', 'fs/promises'), minus `default`
// and anything that isn't a plain identifier, so each generated `export const <name>` parses.
const builtinExportNames = async (specifier: string): Promise<string[]> => {
  try {
    const real = await import(/* @vite-ignore */ `node:${specifier}`);
    return Object.keys(real).filter(name => name !== 'default' && /^[A-Za-z_$][\w$]*$/.test(name));
  } catch {
    return [];
  }
};

const BROWSER_STUB = '\0browser-stub:';
const BUILTIN_STUB = '\0builtin-stub:';

const stubBrowserPackagesPlugin: Plugin = {
  name: 'stub-browser-packages',
  enforce: 'pre',
  apply: 'serve',
  resolveId(source) {
    if (source in browserStubPackages) {
      return { id: `${BROWSER_STUB}${source}`, moduleSideEffects: false };
    }
    // Keep the subpath (stream/web != stream, fs/promises != fs) so the stub mirrors the right module.
    const specifier = source.startsWith('node:') ? source.slice(5) : source;
    if (builtinModules.includes(specifier.split('/')[0])) {
      return { id: `${BUILTIN_STUB}${specifier}`, moduleSideEffects: false };
    }
  },
  async load(id) {
    if (id.startsWith(BROWSER_STUB)) {
      return stubModuleCode(browserStubPackages[id.slice(BROWSER_STUB.length)] ?? []);
    }
    if (id.startsWith(BUILTIN_STUB)) {
      return stubModuleCode(await builtinExportNames(id.slice(BUILTIN_STUB.length)));
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
      // stub plugin above answer the bare imports instead. Derived from the stub map so the two
      // never drift (a package must be both excluded AND stubbed, or neither works).
      exclude: Object.keys(browserStubPackages),
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
