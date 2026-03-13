import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execa } from 'execa';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';

const timeout = 5 * 60 * 1000;

describe('optimized dependency cache', () => {
  let fixturePath: string;
  const pkgManager = 'pnpm';

  async function runBuild() {
    const { stdout, stderr } = await execa(pkgManager, ['build'], {
      cwd: fixturePath,
      env: process.env,
    });

    return `${stdout}\n${stderr}`;
  }

  beforeAll(
    async () => {
      const registry = inject('registry');
      const tag = inject('tag');

      fixturePath = await mkdtemp(join(tmpdir(), 'mastra-optimized-cache-e2e-'));
      process.env.npm_config_registry = registry;

      await mkdir(join(fixturePath, 'src', 'mastra'), { recursive: true });
      await writeFile(
        join(fixturePath, 'package.json'),
        JSON.stringify(
          {
            name: 'optimized-cache-fixture',
            version: '1.0.0',
            private: true,
            type: 'module',
            packageManager: 'pnpm@10.29.3',
            scripts: {
              build: 'mastra build',
            },
            dependencies: {
              '@mastra/core': tag,
              mastra: tag,
              zod: '3.25.76',
            },
          },
          null,
          2,
        ) + '\n',
      );

      await writeFile(
        join(fixturePath, 'src', 'mastra', 'index.ts'),
        `import { Mastra } from '@mastra/core/mastra';
import { z } from 'zod';

const schema = z.object({ value: z.string() });
void schema;

export const mastra = new Mastra({
  bundler: {
    externals: [],
  },
});
`,
      );

      await execa(pkgManager, ['install'], {
        cwd: fixturePath,
        stdio: 'inherit',
        env: process.env,
      });

      await runBuild();
    },
    10 * 60 * 1000,
  );

  afterAll(async () => {
    try {
      await rm(fixturePath, { force: true, recursive: true });
    } catch {}
  });

  it(
    'should reuse optimized dependencies on repeated builds',
    async () => {
      const buildOutput = await runBuild();

      expect(buildOutput).toContain('Optimizing dependencies... (cache hit)');
    },
    timeout,
  );

  it(
    'should change cache key after dependency version update',
    async () => {
      const cacheFilePath = join(fixturePath, '.mastra', '.build', '.optimized-dependencies-cache.json');
      const cacheBefore = JSON.parse(await readFile(cacheFilePath, 'utf-8')) as { key: string };

      expect(cacheBefore.key).toBeTruthy();

      const zodPackageJsonPath = join(fixturePath, 'node_modules', 'zod', 'package.json');
      const zodPackageJson = JSON.parse(await readFile(zodPackageJsonPath, 'utf-8')) as { version?: string };
      const currentVersion = zodPackageJson.version ?? '0.0.0';
      zodPackageJson.version = `${currentVersion}-cache-test`;
      await writeFile(zodPackageJsonPath, JSON.stringify(zodPackageJson, null, 2) + '\n');

      const buildOutput = await runBuild();

      const cacheAfter = JSON.parse(await readFile(cacheFilePath, 'utf-8')) as { key: string };
      expect(buildOutput).not.toContain('Optimizing dependencies... (cache hit)');
      expect(cacheAfter.key).not.toBe(cacheBefore.key);
    },
    timeout,
  );
});
