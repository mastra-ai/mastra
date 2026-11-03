import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { rolldown } from 'rolldown';
import type { InputOptions } from 'rolldown';
import { afterEach, describe, expect, it } from 'vitest';
import type { BundlerPlatform } from '../utils';
import { cjsGlobalsDefine, getPlatformOptions } from './options';
import { scopedDefine } from './plugins';

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'plugins', '__fixtures__');
const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })));
});

async function build(input: string, options: Omit<InputOptions, 'input'>) {
  const bundle = await rolldown({ logLevel: 'silent', experimental: { attachDebugInfo: 'none' }, ...options, input });
  try {
    const { output } = await bundle.generate({ format: 'esm' });
    return output[0].code;
  } finally {
    await bundle.close();
  }
}

function buildFixture(fixture: string, platform: BundlerPlatform, enabled = true) {
  return build(join(fixturesDir, fixture), {
    ...getPlatformOptions(platform),
    transform: { define: cjsGlobalsDefine(enabled, platform) },
  });
}

async function createTempDir() {
  const dir = await mkdtemp(join(tmpdir(), 'mastra-rolldown-options-'));
  tempDirs.push(dir);
  return dir;
}

describe('cjsGlobalsDefine', () => {
  it('replaces free __dirname and __filename with their import.meta equivalents', async () => {
    const code = await buildFixture('esm-shim-no-declaration.js', 'node');

    expect(code).toContain('import.meta.dirname');
    expect(code).toContain('import.meta.filename');
    expect(code).not.toMatch(/\b__dirname\b|\b__filename\b/);

    // The output resolves to its own location when it runs.
    const outDir = await createTempDir();
    const outFile = join(outDir, 'index.mjs');
    await writeFile(outFile, code);
    const mod = await import(pathToFileURL(outFile).href);
    expect(mod.getDir()).toBe(outDir);
    expect(mod.getFile()).toBe(outFile);
  });

  it.each([
    ['esm-shim-user-declared.js', ['__dirname', '__filename']],
    ['esm-shim-only-dirname.js', ['__dirname']],
    ['esm-shim-only-filename.js', ['__filename']],
  ])('leaves user-declared globals in %s untouched', async (fixture, declared) => {
    const code = await buildFixture(fixture, 'node');

    expect(code).toContain('fileURLToPath(import.meta.url)');
    expect(code).not.toContain('import.meta.dirname');
    expect(code).not.toContain('import.meta.filename');
    for (const name of declared) {
      expect(code).toMatch(new RegExp(`\\bconst ${name}\\b`));
    }
  });

  it('defines nothing for the browser platform or when the shim is disabled', async () => {
    expect(cjsGlobalsDefine(true, 'browser')).toEqual({});
    expect(cjsGlobalsDefine(false, 'node')).toEqual({});

    const code = await buildFixture('esm-shim-no-declaration.js', 'browser');
    expect(code).toContain('__dirname');
    expect(code).toContain('__filename');
    expect(code).not.toContain('import.meta');
  });
});

describe('scopedDefine', () => {
  const define = { 'process.env.NODE_ENV': JSON.stringify('production') };

  async function buildProject(userCode: string, depCode = 'export const depEnv = process.env.NODE_ENV;\n') {
    const root = await createTempDir();
    const entry = join(root, 'src', 'index.js');
    const depDir = join(root, 'node_modules', 'dep');
    await mkdir(dirname(entry), { recursive: true });
    await mkdir(depDir, { recursive: true });
    await writeFile(entry, userCode);
    await writeFile(
      join(depDir, 'package.json'),
      JSON.stringify({ name: 'dep', version: '1.0.0', type: 'module', main: 'index.js' }),
    );
    await writeFile(join(depDir, 'index.js'), depCode);

    return build(entry, { cwd: root, platform: 'node', treeshake: false, plugins: [scopedDefine(define)] });
  }

  it('returns no plugin when there is nothing to define', () => {
    expect(scopedDefine({})).toBeNull();
  });

  it('replaces process.env.NODE_ENV in user files', async () => {
    const code = await buildProject(
      `export const env = process.env.NODE_ENV;\nexport const isDev = process.env.NODE_ENV == 'development';\n`,
    );

    expect(code).toMatch(/const env = "production"/);
    expect(code).not.toContain('process.env');
  });

  it('does not replace process.env.NODE_ENV inside node_modules', async () => {
    const code = await buildProject(`export { depEnv } from 'dep';\n`);

    expect(code).toContain('depEnv = process.env.NODE_ENV');
  });

  it('does not replace assignment targets', async () => {
    const code = await buildProject(`export function setEnv(value) {\n  process.env.NODE_ENV = value;\n}\n`);

    expect(code).toContain('process.env.NODE_ENV = value');
  });

  it('does not replace member accesses ending in process.env.NODE_ENV', async () => {
    const code = await buildProject(`export const read = a => a.process.env.NODE_ENV;\n`);

    expect(code).toContain('a.process.env.NODE_ENV');
    expect(code).not.toContain('"production"');
  });
});
