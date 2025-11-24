import { it, describe, expect, beforeAll, afterAll, inject } from 'vitest';
import { join } from 'path';
import { setupMonorepo } from './prepare';
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

  async function runBuild(path: string) {
    await execa(pkgManager, ['build'], {
      cwd: join(path, 'apps', 'custom'),
      stdio: 'inherit',
      env: process.env,
    });
  }

  beforeAll(
    async () => {
      const registry = inject('registry');

      fixturePath = await mkdtemp(join(tmpdir(), `mastra-no-bundling-test-${pkgManager}-`));
      process.env.npm_config_registry = registry;
      await setupMonorepo(fixturePath, pkgManager);
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

  describe.sequential('dev', async () => {
    let port = await getPort();
    let proc: ReturnType<typeof execa> | undefined;
    const controller = new AbortController();
    const cancelSignal = controller.signal;

    beforeAll(async () => {
      const inputFile = join(fixturePath, 'apps', 'custom');
      proc = execa('npm', ['run', 'dev'], {
        cwd: inputFile,
        cancelSignal,
        gracefulCancel: true,
        env: {
          OPENAI_API_KEY: process.env.OPENAI_API_KEY,
          MASTRA_PORT: port.toString(),
        },
      });

      activeProcesses.push({ controller, proc });

      await new Promise<void>((resolve, reject) => {
        proc!.stderr?.on('data', data => {
          const errMsg = data?.toString();
          if (errMsg && errMsg.includes('punycode')) {
            // Ignore punycode warning
            return;
          }
          reject(new Error('failed to start dev: ' + errMsg));
        });
        proc!.stdout?.on('data', data => {
          process.stdout.write(data?.toString());
          if (data?.toString()?.includes(`http://localhost:${port}`)) {
            resolve();
          }
        });
      });
    }, timeout);

    // TODO: Add path tests

    afterAll(async () => {
      if (proc) {
        try {
          proc.kill('SIGKILL');
        } catch (err) {
          // @ts-expect-error - isCanceled is not typed
          if (!err.killed) {
            console.log('failed to kill build proc', err);
          }
        }
      }
    }, timeout);
  });

  describe.sequential('build', async () => {
    let port = await getPort();
    let proc: ReturnType<typeof execa> | undefined;
    const controller = new AbortController();
    const cancelSignal = controller.signal;

    beforeAll(async () => {
      await runBuild(fixturePath);

      const inputFile = join(fixturePath, 'apps', 'custom', '.mastra', 'output');
      proc = execaNode('index.mjs', {
        cwd: inputFile,
        cancelSignal,
        env: {
          OPENAI_API_KEY: process.env.OPENAI_API_KEY,
          MASTRA_PORT: port.toString(),
        },
      });

      activeProcesses.push({ controller, proc });

      await new Promise<void>((resolve, reject) => {
        proc!.stderr?.on('data', data => {
          const errMsg = data?.toString();
          if (errMsg && errMsg.includes('punycode')) {
            // Ignore punycode warning
            return;
          }

          reject(new Error('failed to start: ' + errMsg));
        });
        proc!.stdout?.on('data', data => {
          console.log(data?.toString());
          if (data?.toString()?.includes(`http://localhost:${port}`)) {
            resolve();
          }
        });
      });
    }, timeout);

    // TODO: Add path tests

    afterAll(async () => {
      if (proc) {
        try {
          setImmediate(() => controller.abort());
          await proc;
        } catch (err) {
          // @ts-expect-error - isCanceled is not typed
          if (!err.isCanceled) {
            console.log('failed to kill build proc', err);
          }
        }
      }
    }, timeout);
  });

  describe.sequential('start', async () => {
    let port = await getPort();
    let proc: ReturnType<typeof execa> | undefined;
    const controller = new AbortController();
    const cancelSignal = controller.signal;

    beforeAll(async () => {
      await runBuild(fixturePath);

      const inputFile = join(fixturePath, 'apps', 'custom');

      console.log('started proc', port);
      proc = execa('npm', ['run', 'start'], {
        cwd: inputFile,
        cancelSignal,
        gracefulCancel: true,
        env: {
          OPENAI_API_KEY: process.env.OPENAI_API_KEY,
          MASTRA_PORT: port.toString(),
        },
      });

      activeProcesses.push({ controller, proc });

      // Poll the server until it's ready
      const maxAttempts = 60;
      const delayMs = 1000;
      for (let i = 0; i < maxAttempts; i++) {
        try {
          const res = await fetch(`http://localhost:${port}/api/tools`);
          if (res.ok) {
            console.log('Server is ready');
            break;
          }
        } catch {
          // Server not ready yet
        }

        if (i === maxAttempts - 1) {
          throw new Error('Server failed to start within timeout');
        }

        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }, timeout);

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
