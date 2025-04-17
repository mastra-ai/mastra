import { it, describe, expect, beforeAll, afterAll } from 'vitest';
import { rollup } from 'rollup';
import { join } from 'path';
import { setupMonorepo } from './setup';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import getPort from 'get-port';
import { execa, ExecaError } from 'execa';

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

  function runApiTests(port: number) {
    it('should resolve api routes', async () => {
      const res = await fetch(`http://localhost:${port}/test`);
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body).toEqual({ message: 'Hello, world!' });
    });
  }

  describe('dev', async () => {
    let port = await getPort();
    let proc: ReturnType<typeof execa> | undefined;
    const controller = new AbortController();
    const cancelSignal = controller.signal;

    beforeAll(
      async () => {
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

        await new Promise<void>(resolve => {
          proc!.stdout?.on('data', data => {
            console.log(data?.toString());
            if (data?.toString()?.includes(`http://localhost:${port}`)) {
              resolve();
            }
          });
        });
      },
      60 * 10 * 1000,
    );

    afterAll(
      async () => {
        if (proc) {
          try {
            proc!.kill('SIGINT');
          } catch {}
        }
      },
      60 * 10 * 1000,
    );

    runApiTests(port);
  });

  describe('build', async () => {
    let port = await getPort();
    let proc: ReturnType<typeof execa> | undefined;
    const controller = new AbortController();
    const cancelSignal = controller.signal;

    beforeAll(
      async () => {
        const inputFile = join(fixturePath, 'apps', 'custom', '.mastra', 'output');
        proc = execa('node', ['index.mjs'], {
          cwd: inputFile,
          cancelSignal,
          gracefulCancel: true,
          env: {
            OPENAI_API_KEY: process.env.OPENAI_API_KEY,
            MASTRA_PORT: port.toString(),
          },
        });

        await new Promise<void>(resolve => {
          proc!.stdout?.on('data', data => {
            console.log(data?.toString());
            if (data?.toString()?.includes(`http://localhost:${port}`)) {
              resolve();
            }
          });
        });
      },
      60 * 2 * 1000,
    );

    afterAll(
      async () => {
        if (proc) {
          try {
            setImmediate(() => controller.abort());
            await proc;
          } catch {
            console.log('failed to kill build proc');
          }
        }
      },
      60 * 2 * 1000,
    );

    runApiTests(port);
  });
});
