import { it, describe, expect, afterAll } from 'vitest';
import { rollup } from 'rollup';
import { join } from 'path';
import { fixturePath } from './scripts';
import { existsSync } from 'fs';
import { rm } from 'fs/promises';

describe('tsconfig paths', () => {
  afterAll(async () => {
    try {
      await rm(fixturePath, {
        force: true,
      });
    } catch {}
  });

  it('should resolve paths', async () => {
    const inputFile = join(fixturePath, 'apps', 'custom', '.mastra', 'output', 'index.mjs');
    const bundle = await rollup({
      logLevel: 'silent',
      input: inputFile,
    });

    const result = await bundle.generate({
      format: 'esm',
    });
    let hasMappedPkg = false;
    for (const output of Object.values(result.output)) {
      hasMappedPkg = hasMappedPkg || output.imports.includes('@/agents');
    }

    expect(hasMappedPkg).toBeFalsy();
  });
});
