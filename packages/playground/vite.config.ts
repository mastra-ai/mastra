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
      .replace(/%%MASTRA_AGENT_SIGNALS%%/g, process.env.MASTRA_AGENT_SIGNALS ?? 'true')
      .replace(/%%MASTRA_SIGNALS_UI%%/g, process.env.MASTRA_SIGNALS_UI || 'false');
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

const getNodeStubSource = (source: string) => {
  const moduleName = (source.startsWith('node:') ? source.slice(5) : source).split('/')[0];

  const baseStub = `
    class NodeStub {
      constructor() {}
      on() { return this; }
      once() { return this; }
      off() { return this; }
      emit() { return false; }
      addListener() { return this; }
      removeListener() { return this; }
      pipe() { return this; }
      unpipe() { return this; }
      write() { return true; }
      end() { return this; }
      push() { return true; }
      destroy() { return this; }
    }
    const noop = () => undefined;
    const asyncNoop = async () => undefined;
  `;

  switch (moduleName) {
    case 'stream':
      return {
        code: `${baseStub}
          export class Transform extends NodeStub {}
          export class PassThrough extends Transform {}
          export class Readable extends NodeStub {}
          export class Writable extends NodeStub {}
          export class Duplex extends Transform {}
          export const ReadableStream = globalThis.ReadableStream ?? NodeStub;
          export const WritableStream = globalThis.WritableStream ?? NodeStub;
          export const TransformStream = globalThis.TransformStream ?? NodeStub;
          export const pipeline = noop;
          export const finished = noop;
          export default {
            Transform,
            PassThrough,
            Readable,
            Writable,
            Duplex,
            ReadableStream,
            WritableStream,
            TransformStream,
            pipeline,
            finished,
          };
        `,
      };
    case 'events':
      return {
        code: `${baseStub}
          export class EventEmitter extends NodeStub {}
          export default EventEmitter;
        `,
      };
    case 'crypto':
      return {
        code: `${baseStub}
          export const createHash = () => ({ update() { return this; }, digest() { return ''; } });
          export const createHmac = () => ({ update() { return this; }, digest() { return ''; } });
          export const randomUUID = () => globalThis.crypto?.randomUUID?.() ?? '';
          export const randomBytes = () => new Uint8Array();
          export default { createHash, createHmac, randomUUID, randomBytes };
        `,
      };
    case 'path':
      return {
        code: `${baseStub}
          export const join = (...parts) => parts.filter(Boolean).join('/');
          export const resolve = (...parts) => join(...parts);
          export const dirname = value => String(value ?? '').split('/').slice(0, -1).join('/') || '.';
          export const basename = value => String(value ?? '').split('/').pop() ?? '';
          export const extname = value => {
            const base = basename(value);
            const index = base.lastIndexOf('.');
            return index > 0 ? base.slice(index) : '';
          };
          export const normalize = value => String(value ?? '');
          export const relative = (_from, to) => String(to ?? '');
          export const isAbsolute = value => String(value ?? '').startsWith('/');
          export const parse = value => ({ root: '', dir: dirname(value), base: basename(value), ext: extname(value), name: basename(value).replace(extname(value), '') });
          export const sep = '/';
          export const posix = { join, resolve, dirname, basename, extname, normalize, relative, isAbsolute, parse, sep };
          export default posix;
        `,
      };
    case 'fs':
      return {
        code: `${baseStub}
          export const readFile = asyncNoop;
          export const writeFile = asyncNoop;
          export const mkdir = asyncNoop;
          export const access = asyncNoop;
          export const stat = asyncNoop;
          export const unlink = asyncNoop;
          export const open = asyncNoop;
          export const rm = asyncNoop;
          export const mkdtemp = async value => String(value ?? '');
          export const readdir = async () => [];
          export const realpath = async value => String(value ?? '');
          export const appendFile = asyncNoop;
          export const copyFile = asyncNoop;
          export const rename = asyncNoop;
          export const rmdir = asyncNoop;
          export const readlink = async value => String(value ?? '');
          export const symlink = asyncNoop;
          export const lstat = async () => ({ isDirectory: () => false, isFile: () => false, isSymbolicLink: () => false });
          export const existsSync = () => false;
          export const readdirSync = () => [];
          export const lstatSync = () => ({ isDirectory: () => false, isFile: () => false });
          export const unlinkSync = noop;
          export const mkdirSync = noop;
          export const openSync = () => 0;
          export const closeSync = noop;
          export const writeSync = noop;
          export const fstatSync = () => ({ size: 0 });
          export const realpathSync = value => String(value ?? '');
          export const statSync = () => ({ isDirectory: () => false, isFile: () => false });
          export const readFileSync = noop;
          export const writeFileSync = noop;
          export const renameSync = noop;
          export const rmSync = noop;
          export const constants = {};
          export const promises = {
            readFile,
            writeFile,
            mkdir,
            access,
            stat,
            unlink,
            open,
            rm,
            mkdtemp,
            readdir,
            realpath,
            appendFile,
            copyFile,
            rename,
            rmdir,
            readlink,
            symlink,
            lstat,
          };
          export default {
            readFile,
            writeFile,
            mkdir,
            access,
            stat,
            unlink,
            open,
            rm,
            mkdtemp,
            readdir,
            realpath,
            appendFile,
            copyFile,
            rename,
            rmdir,
            readlink,
            symlink,
            lstat,
            existsSync,
            readdirSync,
            lstatSync,
            unlinkSync,
            mkdirSync,
            openSync,
            closeSync,
            writeSync,
            fstatSync,
            realpathSync,
            statSync,
            readFileSync,
            writeFileSync,
            renameSync,
            rmSync,
            constants,
            promises,
          };
        `,
      };
    case 'buffer':
      return {
        code: `${baseStub}
          export const Buffer = globalThis.Buffer ?? Uint8Array;
          export default { Buffer };
        `,
      };
    case 'url':
      return {
        code: `${baseStub}
          export const fileURLToPath = value => String(value ?? '');
          export const pathToFileURL = value => new URL(String(value ?? ''), 'file://');
          export default { fileURLToPath, pathToFileURL };
        `,
      };
    case 'util':
      return {
        code: `${baseStub}
          export const promisify = fn => fn;
          export const inspect = value => String(value);
          export const inherits = noop;
          export default { promisify, inspect, inherits };
        `,
      };
    case 'module':
      return {
        code: `${baseStub}
          export const createRequire = () => () => ({});
          export default { createRequire };
        `,
      };
    case 'async_hooks':
      return {
        code: `${baseStub}
          export class AsyncLocalStorage {
            getStore() { return undefined; }
            run(_store, callback, ...args) { return callback?.(...args); }
            enterWith() {}
            disable() {}
          }
          export default { AsyncLocalStorage };
        `,
      };
    case 'child_process':
      return {
        code: `${baseStub}
          export const execFile = noop;
          export const execFileSync = noop;
          export default { execFile, execFileSync };
        `,
      };
    case 'net':
      return {
        code: `${baseStub}
          export const createConnection = () => new NodeStub();
          export default { createConnection };
        `,
      };
    case 'string_decoder':
      return {
        code: `${baseStub}
          export class StringDecoder {
            write(value) { return String(value ?? ''); }
            end(value) { return String(value ?? ''); }
          }
          export default { StringDecoder };
        `,
      };
    case 'os':
      return {
        code: `${baseStub}
          export const tmpdir = () => '/tmp';
          export const homedir = () => '';
          export const platform = () => 'browser';
          export const totalmem = () => 0;
          export const cpus = () => [];
          export default { tmpdir, homedir, platform, totalmem, cpus };
        `,
      };
    default:
      return {
        code: `${baseStub}
          export { noop };
          export default {};
        `,
      };
  }
};

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
      return getNodeStubSource(id.slice('\0node-stub:'.length));
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
      dedupe: ['react', 'react-dom', 'react/jsx-runtime', 'react-resizable-panels', '@tanstack/react-query'],
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
    optimizeDeps: {
      exclude: ['@standard-schema/spec'],
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
