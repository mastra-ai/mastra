import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import nodeResolve from '@rollup/plugin-node-resolve';
import { rollup } from 'rollup';
import { afterEach, describe, expect, it } from 'vitest';
import type { BundlerPlatform } from '../utils';
import { moduleAlias } from './module-alias';

const tempDirs: string[] = [];

async function createTempDir() {
  const dir = await mkdtemp(join(tmpdir(), 'mastra-module-alias-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })));
});

async function generate(
  entry: string,
  alias: Record<string, string>,
  resolveFrom = entry,
  external?: string[],
  platform: BundlerPlatform = 'node',
) {
  const bundle = await rollup({
    input: entry,
    external,
    plugins: [moduleAlias(alias, resolveFrom, platform), nodeResolve()].filter(Boolean),
  });

  try {
    const { output } = await bundle.generate({ format: 'esm' });
    return output[0]?.code ?? '';
  } finally {
    await bundle.close();
  }
}

describe('moduleAlias', () => {
  it('redirects an exact specifier to a path shim', async () => {
    const root = await createTempDir();
    const entry = join(root, 'entry.mjs');
    const shim = join(root, 'shim.mjs');
    await Promise.all([
      writeFile(entry, `import value from 'ajv'; export { value };`),
      writeFile(shim, `export default 'shim-value';`),
    ]);

    const code = await generate(entry, { ajv: shim });

    expect(code).toContain('shim-value');
    expect(code).not.toContain("from 'ajv'");
  });

  it('requires separate aliases for subpath specifiers', async () => {
    const root = await createTempDir();
    const entry = join(root, 'entry.mjs');
    const rootShim = join(root, 'root-shim.mjs');
    const subpathShim = join(root, 'subpath-shim.mjs');
    await Promise.all([
      writeFile(
        entry,
        `import rootValue from 'ajv'; import subpathValue from 'ajv/dist/2020.js'; import untouched from 'ajv/other'; export { rootValue, subpathValue, untouched };`,
      ),
      writeFile(rootShim, `export default 'root-shim';`),
      writeFile(subpathShim, `export default 'subpath-shim';`),
    ]);

    const code = await generate(entry, { ajv: rootShim, 'ajv/dist/2020.js': subpathShim }, entry, ['ajv/other']);

    expect(code).toContain('root-shim');
    expect(code).toContain('subpath-shim');
    expect(code).toContain("from 'ajv/other'");
  });

  it('applies an alias whose specifier is also another alias target', async () => {
    const root = await createTempDir();
    const entry = join(root, 'entry.mjs');
    const shim = join(root, 'shim.mjs');
    await Promise.all([
      writeFile(entry, `import value from 'replacement'; export { value };`),
      writeFile(shim, `export default 'replacement-shim';`),
    ]);

    const code = await generate(entry, { original: 'replacement', replacement: shim });

    expect(code).toContain('replacement-shim');
  });

  it('resolves a bare target from the original importer', async () => {
    const root = await createTempDir();
    const nested = join(root, 'nested');
    const rootPackage = join(root, 'node_modules', 'replacement');
    const nestedPackage = join(nested, 'node_modules', 'replacement');
    const entry = join(nested, 'entry.mjs');
    await Promise.all([mkdir(rootPackage, { recursive: true }), mkdir(nestedPackage, { recursive: true })]);
    await Promise.all([
      writeFile(entry, `import value from 'original'; export { value };`),
      writeFile(
        join(rootPackage, 'package.json'),
        JSON.stringify({ name: 'replacement', type: 'module', main: 'index.js' }),
      ),
      writeFile(join(rootPackage, 'index.js'), `export default 'root-replacement';`),
      writeFile(
        join(nestedPackage, 'package.json'),
        JSON.stringify({ name: 'replacement', type: 'module', main: 'index.js' }),
      ),
      writeFile(join(nestedPackage, 'index.js'), `export default 'nested-replacement';`),
    ]);

    const code = await generate(entry, { original: 'replacement' }, join(root, 'entry.mjs'));

    expect(code).toContain('nested-replacement');
    expect(code).not.toContain('root-replacement');
  });

  it('resolves bare targets with export conditions for the target platform', async () => {
    const root = await createTempDir();
    const packageDir = join(root, 'node_modules', 'replacement');
    const entry = join(root, 'entry.mjs');
    await mkdir(packageDir, { recursive: true });
    await Promise.all([
      writeFile(entry, `import value from 'original'; export { value };`),
      writeFile(
        join(packageDir, 'package.json'),
        JSON.stringify({
          name: 'replacement',
          version: '1.0.0',
          type: 'module',
          exports: {
            '.': {
              browser: './browser.js',
              node: './node.js',
              default: './default.js',
            },
          },
        }),
      ),
      writeFile(join(packageDir, 'browser.js'), `export default 'browser-replacement';`),
      writeFile(join(packageDir, 'node.js'), `export default 'node-replacement';`),
      writeFile(join(packageDir, 'default.js'), `export default 'default-replacement';`),
    ]);

    const code = await generate(entry, { original: 'replacement' }, entry, ['replacement'], 'browser');

    expect(code).toContain('browser-replacement');
    expect(code).not.toContain('node-replacement');
  });

  it('throws a MastraError when the target cannot be resolved', async () => {
    const root = await createTempDir();
    const entry = join(root, 'entry.mjs');
    await writeFile(entry, `import value from 'original'; export { value };`);

    await expect(generate(entry, { original: 'missing-replacement' })).rejects.toMatchObject({
      id: 'DEPLOYER_ALIAS_TARGET_NOT_FOUND',
      message: expect.stringContaining('missing-replacement'),
    });
  });
});
