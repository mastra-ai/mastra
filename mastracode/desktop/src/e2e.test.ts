import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { writeDesktopE2EProgress } from './e2e.js';

const PROGRESS_FILE_ENV = 'MASTRACODE_DESKTOP_E2E_PROGRESS_FILE';
const originalProgressFile = process.env[PROGRESS_FILE_ENV];

afterEach(() => {
  if (originalProgressFile === undefined) Reflect.deleteProperty(process.env, PROGRESS_FILE_ENV);
  else process.env[PROGRESS_FILE_ENV] = originalProgressFile;
});

describe('writeDesktopE2EProgress', () => {
  it('serializes concurrent startup writes into complete JSON', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'mastracode-e2e-progress-'));
    const progressFile = join(directory, 'progress.json');
    process.env[PROGRESS_FILE_ENV] = progressFile;

    try {
      await Promise.all(
        Array.from({ length: 12 }, (_, index) => writeDesktopE2EProgress(`startup-${index}`, { index })),
      );

      expect(JSON.parse(await readFile(progressFile, 'utf-8'))).toMatchObject({
        stage: 'startup-11',
        details: { index: 11 },
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
