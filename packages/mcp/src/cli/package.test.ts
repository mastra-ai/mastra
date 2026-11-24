import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../../', import.meta.url));
const blocker = new URL('./__fixtures__/block-cli-dependencies.mjs', import.meta.url).href;

describe('built MCP package', () => {
  it('keeps executable ESM CLI separate from both library formats and declarations', async () => {
    const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
    expect(manifest.bin).toEqual({ 'mastra-mcp': 'dist/cli/index.js' });
    // Only `mastra-mcp generate` uses these, so library users must not install them (M3 package size).
    for (const helper of ['tsx', 'json-schema-to-typescript-lite']) {
      expect(manifest.dependencies[helper]).toBeUndefined();
      expect(manifest.peerDependencies[helper]).toBeTruthy();
      expect(manifest.peerDependenciesMeta[helper]).toEqual({ optional: true });
    }
    expect(await readFile(join(root, manifest.bin['mastra-mcp']), 'utf8')).toMatch(/^#!\/usr\/bin\/env node\n/);
    expect((await stat(join(root, manifest.bin['mastra-mcp']))).mode & 0o111).not.toBe(0);
    for (const file of ['index.js', 'index.cjs', 'index.d.ts'])
      expect((await stat(join(root, 'dist', file))).isFile()).toBe(true);
  });

  it.each(['esm', 'cjs'])('imports the actual %s library while CLI dependency loading is blocked', format => {
    const script =
      format === 'esm'
        ? `const {MCPClient}=await import('@mastra/mcp'); const c=new MCPClient({servers:{}}); await c.disconnect(); console.log('isolated');`
        : `const {MCPClient}=require('@mastra/mcp'); const c=new MCPClient({servers:{}}); c.disconnect().then(()=>console.log('isolated'));`;
    const output = execFileSync(
      process.execPath,
      ['--import', blocker, ...(format === 'esm' ? ['--input-type=module'] : []), '-e', script],
      {
        cwd: root,
        encoding: 'utf8',
        env: { ...process.env, TSX_TSCONFIG_PATH: '', NODE_OPTIONS: '' },
      },
    );
    expect(output.trim()).toBe('isolated');
    // Confirm the blocker itself is active, rather than trusting a source grep.
    expect(() =>
      execFileSync(process.execPath, ['--import', blocker, '-e', "require('json-schema-to-typescript-lite')"], {
        cwd: root,
        stdio: 'pipe',
      }),
    ).toThrow();
  });

  it('selects a real client exported by the CommonJS library build', async () => {
    const directory = await mkdtemp(join(root, '.cjs-client-test-'));
    try {
      await writeFile(
        join(directory, 'client.cjs'),
        `const {MCPClient}=require('@mastra/mcp'); module.exports=new MCPClient({servers:{},typegen:{outFile:'generated.ts'}});`,
      );
      const output = execFileSync(process.execPath, [join(root, 'dist/cli/index.js'), 'generate', 'client.cjs'], {
        cwd: directory,
        encoding: 'utf8',
        env: { ...process.env, TSX_TSCONFIG_PATH: '', NODE_OPTIONS: '' },
      });
      expect(output).toContain('Generated 1');
      expect(await readFile(join(directory, 'generated.ts'), 'utf8')).toContain('MCPServers');
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('tells a user without the generator helpers what to install, before touching their project', async () => {
    const directory = await mkdtemp(join(root, '.missing-helpers-test-'));
    try {
      await writeFile(
        join(directory, 'client.mjs'),
        `import {writeFileSync} from 'node:fs'; writeFileSync('imported', ''); import {MCPClient} from '@mastra/mcp';
        export const client = new MCPClient({servers:{}, typegen:{outFile:'generated.ts'}});`,
      );
      // The blocker makes both helper specifiers unresolvable, as in an install that never added them.
      const result = spawnSync(
        process.execPath,
        ['--import', blocker, join(root, 'dist/cli/index.js'), 'generate', 'client.mjs'],
        { cwd: directory, encoding: 'utf8', env: { ...process.env, TSX_TSCONFIG_PATH: '', NODE_OPTIONS: '' } },
      );
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('mastra-mcp generate requires tsx and json-schema-to-typescript-lite');
      expect(result.stderr).toContain('npm install --save-dev tsx@4 json-schema-to-typescript-lite@15');
      expect(result.stderr).toContain('pnpm add --save-dev tsx@4 json-schema-to-typescript-lite@15');
      expect(result.stderr).toContain('yarn add --dev tsx@4 json-schema-to-typescript-lite@15');
      expect(result.stderr).toContain('bun add --dev tsx@4 json-schema-to-typescript-lite@15');
      // Fails before importing client modules or writing output.
      expect(await readdir(directory)).toEqual(['client.mjs']);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('tells a contributor without tsx how to install it before any conformance scenario runs', () => {
    const result = spawnSync(process.execPath, ['--import', blocker, join(root, 'src/conformance/launch.mjs')], {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, NODE_OPTIONS: '' },
      timeout: 20_000,
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      'The MCP conformance runner (pnpm --filter ./packages/mcp test:conformance) requires tsx',
    );
    expect(result.stderr).toContain('pnpm --filter ./packages/mcp add --save-dev tsx@4');
    // Nothing ran: the official scenario and the stdio checks print their own output.
    expect(result.stdout).toBe('');
  });

  it('packs the bin, chunks and declarations without installing the generator helpers', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'mcp-package-test-'));
    try {
      execFileSync('pnpm', ['pack', '--pack-destination', directory], { cwd: root, stdio: 'pipe', timeout: 60_000 });
      const archive = join(
        directory,
        (await readdir(directory)).find(file => file.endsWith('.tgz'))!,
      );
      const files = execFileSync('tar', ['-tf', archive], { encoding: 'utf8' });
      expect(files).toContain('package/dist/cli/index.js');
      expect(files).toContain('package/dist/index.cjs');
      expect(files).toContain('package/dist/index.d.ts');
      const manifest = JSON.parse(execFileSync('tar', ['-xOf', archive, 'package/package.json'], { encoding: 'utf8' }));
      expect(manifest.dependencies.tsx).toBeUndefined();
      expect(manifest.dependencies['json-schema-to-typescript-lite']).toBeUndefined();
      expect(manifest.peerDependenciesMeta).toMatchObject({
        tsx: { optional: true },
        'json-schema-to-typescript-lite': { optional: true },
      });
      expect(files).not.toContain('package/src/');
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }, 90_000);
});
