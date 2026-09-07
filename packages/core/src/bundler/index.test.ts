import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { MastraBundler } from './index';

const directories: string[] = [];

class TestBundler extends MastraBundler {
  constructor(private readonly envFiles: string[]) {
    super({ name: 'Test' });
  }

  getEnvFiles(): Promise<string[]> {
    return Promise.resolve(this.envFiles);
  }

  getAllToolPaths(): (string | string[])[] {
    return [];
  }

  async bundle(): Promise<void> {}

  async prepare(): Promise<void> {}

  async writePackageJson(): Promise<void> {}

  async lint(): Promise<void> {}
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map(directory => rm(directory, { recursive: true, force: true })));
});

describe('MastraBundler.loadEnvVars', () => {
  it('layers dotenv files in order so later files override earlier values', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'mastra-bundler-env-'));
    directories.push(directory);
    const base = join(directory, '.env');
    const local = join(directory, '.env.local');
    await Promise.all([
      writeFile(base, 'BASE_ONLY=base\nSHARED=base\n', 'utf8'),
      writeFile(local, 'LOCAL_ONLY=local\nSHARED=local\n', 'utf8'),
    ]);

    await expect(new TestBundler([base, local]).loadEnvVars()).resolves.toEqual(
      new Map([
        ['BASE_ONLY', 'base'],
        ['SHARED', 'local'],
        ['LOCAL_ONLY', 'local'],
      ]),
    );
  });
});
