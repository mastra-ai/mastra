import { it, describe, expect, beforeAll, afterAll } from 'vitest';
import { rollup } from 'rollup';
import { join } from 'path';
import { setupMonorepo } from './setup';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';

describe('tsconfig paths', () => {
  let fixturePath: string;

  beforeAll(async () => {
    fixturePath = await mkdtemp(join(tmpdir(), 'mastra-monorepo-test-'));
    await setupMonorepo(fixturePath);
  }, 60 * 1000);

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
      // @ts-expect-error - dont want to narrow the type
      hasMappedPkg = hasMappedPkg || output.imports?.includes('@/agents');
    }

    expect(hasMappedPkg).toBeFalsy();
  });
});
