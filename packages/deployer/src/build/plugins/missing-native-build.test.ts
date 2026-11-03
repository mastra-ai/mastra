import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rolldown } from 'rolldown';
import type { Plugin } from 'rolldown';
import { afterEach, describe, expect, it } from 'vitest';
import { missingNativeBuildResolver } from './missing-native-build';

const tempDirs: string[] = [];
const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const tempRoot = join(packageRoot, '.tmp');

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })));
});

async function setupFixture(nativePkgFiles: Record<string, string>) {
  await mkdir(tempRoot, { recursive: true });
  const root = await mkdtemp(join(tempRoot, 'missing-native-build-'));
  tempDirs.push(root);

  const files: Record<string, string> = {
    'package.json': JSON.stringify({ name: 'app', version: '1.0.0', type: 'module' }),
    'index.js': `import native from 'native-pkg';\nexport default native;\n`,
    'node_modules/native-pkg/package.json': JSON.stringify({ name: 'native-pkg', version: '1.0.0', main: 'index.js' }),
    ...Object.fromEntries(
      Object.entries(nativePkgFiles).map(([file, content]) => [`node_modules/native-pkg/${file}`, content]),
    ),
  };
  for (const [file, content] of Object.entries(files)) {
    const path = join(root, file);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content);
  }

  return root;
}

async function build(root: string, plugins: Plugin[] = []) {
  const bundle = await rolldown({
    input: join(root, 'index.js'),
    cwd: root,
    platform: 'node',
    logLevel: 'silent',
    plugins: [missingNativeBuildResolver(), ...plugins],
  });
  try {
    return await bundle.generate({ format: 'esm' });
  } finally {
    await bundle.close();
  }
}

async function getBuildError(root: string) {
  try {
    await build(root);
  } catch (err) {
    return err as Error & { errors?: Array<{ id?: string; details?: Record<string, unknown> }> };
  }
  throw new Error('Expected the build to fail');
}

describe('missingNativeBuildResolver', () => {
  it('suggests adding the package to externals when a required .node binary is missing', async () => {
    const root = await setupFixture({
      'index.js': `module.exports = require('./build/Release/addon.node');\n`,
    });

    const err = await getBuildError(root);
    expect(err.message).toContain('We found a possible binary dependency in your bundle');
    expect(err.message).toContain('externals: ["native-pkg"]');
    expect(err.errors?.[0]?.id).toBe('DEPLOYER_BUNDLE_EXTERNALS_MISSING_NATIVE_BUILD');
    expect(err.errors?.[0]?.details?.packageName).toBe('native-pkg');
  });

  it('reports a missing .node binary even when the require is wrapped in try/catch', async () => {
    const root = await setupFixture({
      'index.js': `let binding;\ntry {\n  binding = require('./build/Release/addon.node');\n} catch {}\nmodule.exports = binding;\n`,
    });

    const err = await getBuildError(root);
    expect(err.errors?.[0]?.id).toBe('DEPLOYER_BUNDLE_EXTERNALS_MISSING_NATIVE_BUILD');
  });

  it('lets an existing .node binary resolve normally', async () => {
    const root = await setupFixture({
      'index.js': `module.exports = require('./build/Release/addon.node');\n`,
      'build/Release/addon.node': 'binary',
    });

    // Rolldown cannot parse a binary as JS, so stub the load to prove resolution went through.
    const loadedIds: string[] = [];
    const stubNodeBinary: Plugin = {
      name: 'stub-node-binary',
      load: {
        filter: { id: /\.node$/ },
        handler(id) {
          loadedIds.push(id);
          return `module.exports = 'stubbed-binary';`;
        },
      },
    };

    const { output } = await build(root, [stubNodeBinary]);
    expect(loadedIds).toEqual([join(root, 'node_modules/native-pkg/build/Release/addon.node')]);
    expect(output[0].code).toContain('stubbed-binary');
  });
});
