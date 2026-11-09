import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadEnvVars } from './bundler';

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(directories.splice(0).map(directory => rm(directory, { recursive: true, force: true })));
});

describe('loadEnvVars', () => {
  it('layers dotenv files in order so later files override earlier values', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'mastra-bundler-env-'));
    directories.push(directory);
    const base = join(directory, '.env');
    const local = join(directory, '.env.local');
    await Promise.all([
      writeFile(base, 'BASE_ONLY=base\nSHARED=base\n', 'utf8'),
      writeFile(local, 'LOCAL_ONLY=local\nSHARED=local\n', 'utf8'),
    ]);

    await expect(loadEnvVars([base, local])).resolves.toEqual(
      new Map([
        ['BASE_ONLY', 'base'],
        ['SHARED', 'local'],
        ['LOCAL_ONLY', 'local'],
      ]),
    );
  });
});
