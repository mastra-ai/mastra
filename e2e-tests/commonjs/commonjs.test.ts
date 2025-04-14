import { it, describe, expect, beforeAll, afterAll } from 'vitest';
import { rollup } from 'rollup';
import { join } from 'path';
import { setupTestProject } from './setup';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { execa, ExecaError } from 'execa';

describe('commonjs', () => {
  let fixturePath: string;

  beforeAll(async () => {
    fixturePath = await mkdtemp(join(tmpdir(), 'mastra-commonjs-test-'));
    await setupTestProject(fixturePath);
  }, 60 * 1000);

  afterAll(async () => {
    try {
      await rm(fixturePath, {
        force: true,
      });
    } catch {}
  });

  it('should pass tsc type check', async () => {
    const tsc = await execa({
      cwd: fixturePath,
    })`tsc`;

    expect(tsc.exitCode).toBe(0);
  });
});
