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
      .replace(/%%MASTRA_EXPERIMENTAL_UI%%/g, process.env.MASTRA_EXPERIMENTAL_UI || 'false');
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
    plugins: [stubNodeBuiltinsPlugin, tailwindcss(), react(), routesManifestPlugin()],
    base: './',
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@internal-temp': path.resolve(__dirname, './src/vendor/@mastra'),
      },
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
