import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rollup } from 'rollup';
import { describe, expect, it } from 'vitest';
import { getInputOptions } from './bundler';

describe('getInputOptions module aliases', () => {
  it('applies aliases before externalizing dependencies', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'mastra-bundler-alias-'));
    const entryFile = join(projectRoot, 'entry.ts');
    const shimFile = join(projectRoot, 'shim.ts');

    try {
      await Promise.all([
        writeFile(entryFile, `import { marker } from 'aliased-package';\nexport { marker };\n`),
        writeFile(shimFile, `export const marker = 'MASTRA_ALIAS_SHIM';\n`),
      ]);

      const inputOptions = await getInputOptions(
        entryFile,
        {
          dependencies: new Map(),
          externalDependencies: new Map([['aliased-package', { version: '1.0.0' }]]),
          workspaceMap: new Map(),
        },
        'node',
        undefined,
        {
          projectRoot,
          alias: { 'aliased-package': shimFile },
        },
      );
      const bundler = await rollup({ ...inputOptions, input: entryFile });

      try {
        const { output } = await bundler.generate({ format: 'esm' });
        const code = output.map(chunk => ('code' in chunk ? chunk.code : '')).join('\n');

        expect(code).toContain('MASTRA_ALIAS_SHIM');
        expect(code).not.toContain("from 'aliased-package'");
      } finally {
        await bundler.close();
      }
    } finally {
      await rm(projectRoot, { recursive: true, force: true });
    }
  });

  it('converts CommonJS alias targets when using the externals preset', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'mastra-bundler-alias-cjs-'));
    const entryFile = join(projectRoot, 'entry.ts');
    const shimFile = join(projectRoot, 'shim.cjs');

    try {
      await Promise.all([
        writeFile(entryFile, `import { marker } from 'aliased-package';\nexport { marker };\n`),
        writeFile(shimFile, `exports.marker = 'MASTRA_CJS_ALIAS_SHIM';\n`),
      ]);

      const inputOptions = await getInputOptions(
        entryFile,
        {
          dependencies: new Map(),
          externalDependencies: new Map(),
          workspaceMap: new Map(),
        },
        'node',
        undefined,
        {
          projectRoot,
          externalsPreset: true,
          alias: { 'aliased-package': shimFile },
        },
      );
      const bundler = await rollup({ ...inputOptions, input: entryFile });

      try {
        const { output } = await bundler.generate({ format: 'esm' });
        const code = output.map(chunk => ('code' in chunk ? chunk.code : '')).join('\n');

        expect(code).toContain('MASTRA_CJS_ALIAS_SHIM');
        expect(code).not.toContain("from 'aliased-package'");
      } finally {
        await bundler.close();
      }
    } finally {
      await rm(projectRoot, { recursive: true, force: true });
    }
  });
});
