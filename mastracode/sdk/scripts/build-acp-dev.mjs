import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const runtimeDirectory = process.argv[2];
const localCore = process.argv.includes('--local-core');
if (!runtimeDirectory) {
  throw new Error('Usage: node scripts/build-acp-dev.mjs <directory containing installed mastracode dependencies>');
}
const sdkDirectory = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(import.meta.url);
const coreDirectory = resolve(sdkDirectory, '../../packages/core');
// Use the compiler already installed with the SDK's Vitest/Vite development dependencies.
const vitestRequire = createRequire(require.resolve('vitest/package.json'));
const viteRequire = createRequire(vitestRequire.resolve('vite/package.json'));
const { build } = viteRequire('esbuild');
const outfile = resolve(sdkDirectory, 'node_modules/.acp-dev/local-acp.mjs');
await build({
  stdin: {
    contents: `import { acpMain } from ${JSON.stringify(resolve(sdkDirectory, 'src/acp/index.ts'))}; await acpMain();`,
    resolveDir: sdkDirectory,
    sourcefile: 'acp-dev-entry.ts',
    loader: 'ts',
  },
  outfile,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  sourcemap: true,
  ...(localCore
    ? {
        define: {
          __MASTRA_VERSION__: JSON.stringify(
            JSON.parse(readFileSync(resolve(coreDirectory, 'package.json'), 'utf8')).version,
          ),
        },
      }
    : {}),
  plugins: [
    {
      name: 'installed-workspace-dependencies',
      setup(build) {
        build.onResolve({ filter: /^[^./]/ }, async args => {
          if (args.pluginData?.resolvedDependency || args.path.startsWith('node:')) return;
          if (localCore && (args.path === '@mastra/core' || args.path.startsWith('@mastra/core/'))) {
            const subpath = args.path === '@mastra/core' ? 'index' : args.path.slice('@mastra/core/'.length);
            const source = [
              resolve(coreDirectory, 'src', subpath + '.ts'),
              resolve(coreDirectory, 'src', subpath, 'index.ts'),
            ].find(existsSync);
            if (!source) throw new Error(`No local core source for ${args.path}`);
            return { path: source };
          }
          const dependency = await build.resolve(args.path, {
            kind: args.kind,
            resolveDir: args.path.startsWith('@mastra/') ? resolve(runtimeDirectory) : args.resolveDir,
            pluginData: { resolvedDependency: true },
          });
          if (dependency.errors.length) return { errors: dependency.errors };
          return { path: dependency.path, external: true };
        });
      },
    },
  ],
});
console.error(
  `Built ACP development server: ${outfile} (core: ${localCore ? 'local source' : 'installed dependency'})`,
);
