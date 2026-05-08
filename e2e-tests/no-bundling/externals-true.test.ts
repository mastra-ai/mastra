import { it, describe, expect, beforeAll, afterAll, inject } from 'vitest';
import { join } from 'path';
import { setupTemplate } from './prepare';
import { mkdtemp, mkdir, rm, readFile, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import getPort from 'get-port';
import { execa, execaNode } from 'execa';

const timeout = 5 * 60 * 1000;

const activeProcesses: Array<{ controller: AbortController; proc: ReturnType<typeof execa | typeof execaNode> }> = [];

async function cleanupAllProcesses() {
  for (const { controller, proc } of activeProcesses) {
    try {
      controller.abort();
      await proc.catch(() => {});
    } catch {}
  }
  activeProcesses.length = 0;
}

process.once('SIGINT', async () => {
  await cleanupAllProcesses();
  process.exit(130);
});

process.once('SIGTERM', async () => {
  await cleanupAllProcesses();
  process.exit(143);
});

describe('externals: true', () => {
  let fixturePath: string;
  const pkgManager = 'pnpm';
  let buildPromise: Promise<void> | undefined;

  async function buildFixture() {
    buildPromise ??= execa(pkgManager, ['build'], {
      cwd: fixturePath,
      stdio: 'inherit',
      env: process.env,
    }).then(() => {});

    return buildPromise;
  }

  beforeAll(
    async () => {
      const registry = inject('registry');

      fixturePath = await mkdtemp(join(tmpdir(), `mastra-no-bundling-test-${pkgManager}-`));
      process.env.npm_config_registry = registry;
      await setupTemplate(fixturePath, pkgManager);
    },
    10 * 60 * 1000,
  );

  afterAll(async () => {
    try {
      await rm(fixturePath, {
        force: true,
      });
    } catch {}
  });

  describe('build', () => {
    beforeAll(async () => {
      await buildFixture();
    }, timeout);

    it('should include external deps in output/package.json', async () => {
      const packageJsonPath = join(fixturePath, '.mastra', 'output', 'package.json');
      const packageJsonContent = await readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(packageJsonContent);

      expect(packageJson.dependencies).toBeDefined();
      expect(packageJson.dependencies.zod).toBeDefined();
    });

    it('should not build intermediate chunks', async () => {
      const zodChunkPath = join(fixturePath, '.mastra', '.build', 'zod.mjs');
      await expect(readFile(zodChunkPath)).rejects.toThrow();
    });

    it('should resolve tsconfig alias imports that use .js extensions', async () => {
      const bundlePath = join(fixturePath, '.mastra', 'output', 'index.mjs');
      const bundleContent = await readFile(bundlePath, 'utf-8');

      expect(bundleContent).not.toContain('~/utils/build-flags.js');
    });

    it('should not treat tsconfig aliases as installable packages', async () => {
      const packageJsonPath = join(fixturePath, '.mastra', 'output', 'package.json');
      const packageJsonContent = await readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(packageJsonContent);

      expect(packageJson.dependencies?.['~']).toBeUndefined();
    });
  });

  describe('start', () => {
    let port: number;
    let proc: ReturnType<typeof execa> | undefined;
    const controller = new AbortController();
    const cancelSignal = controller.signal;

    it(
      'should start server successfully',
      async () => {
        await buildFixture();
        port = await getPort();

        proc = execa('npm', ['run', 'start'], {
          cwd: fixturePath,
          cancelSignal,
          gracefulCancel: true,
          env: {
            OPENAI_API_KEY: process.env.OPENAI_API_KEY,
            PORT: port.toString(),
          },
        });

        let stdout = '';
        let stderr = '';
        proc.stdout?.on('data', data => {
          stdout += data.toString();
        });
        proc.stderr?.on('data', data => {
          stderr += data.toString();
        });

        activeProcesses.push({ controller, proc });

        // Poll the server until it's ready
        const maxAttempts = 15;
        const delayMs = 1000;
        let serverStarted = false;

        console.log(`Server URL: http://localhost:${port}`);

        for (let i = 0; i < maxAttempts; i++) {
          try {
            console.log(`Checking if server is ready (attempt ${i + 1}/${maxAttempts})...`);
            const res = await fetch(`http://localhost:${port}/api/tools`);
            if (res.ok) {
              console.log('Server is ready');
              serverStarted = true;
              break;
            }
          } catch {
            // Server not ready yet
          }

          if (i === maxAttempts - 1) {
            console.error('Server stdout:', stdout);
            console.error('Server stderr:', stderr);
            throw new Error('Server failed to start within timeout');
          }

          await new Promise(resolve => setTimeout(resolve, delayMs));
        }

        expect(serverStarted).toBe(true);
      },
      timeout,
    );

    afterAll(async () => {
      if (proc) {
        try {
          proc.kill('SIGKILL');
        } catch (err) {
          // @ts-expect-error - isCanceled is not typed
          if (!err.isCanceled) {
            console.log('failed to kill start proc', err);
          }
        }
      }
    }, timeout);
  });
});
