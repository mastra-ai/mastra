import { it, describe, expect, beforeAll, afterAll, inject } from 'vitest';
import { rollup } from 'rollup';
import { join } from 'path';
import { setupMonorepo } from './prepare';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import getPort from 'get-port';
import { execa, execaNode } from 'execa';

const timeout = 5 * 60 * 1000;

describe.for([['pnpm'] as const])(`%s monorepo`, ([pkgManager]) => {
  let fixturePath: string;

  beforeAll(
    async () => {
      const tag = inject('tag');
      const registry = inject('registry');

      fixturePath = await mkdtemp(join(tmpdir(), `mastra-monorepo-test-${pkgManager}-`));
      process.env.npm_config_registry = registry;
      await setupMonorepo(fixturePath, tag, pkgManager);
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

  describe('tsconfig paths', () => {
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

  function runApiTests(port: number) {
    it('should resolve api routes', async () => {
      const res = await fetch(`http://localhost:${port}/test`);
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body).toEqual({ message: 'Hello, world!', a: 'b' });
    });
    it('should resolve api ALL routes', async () => {
      let res = await fetch(`http://localhost:${port}/all`);
      let body = await res.json();
      expect(res.status).toBe(200);
      expect(body).toEqual({ message: 'Hello, GET!' });

      res = await fetch(`http://localhost:${port}/all`, {
        method: 'POST',
      });
      body = await res.json();
      expect(res.status).toBe(200);
      expect(body).toEqual({ message: 'Hello, POST!' });
    });

    it('should return tools from the api', async () => {
      const res = await fetch(`http://localhost:${port}/api/tools`);
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(Object.keys(body)).toEqual(['calculatorTool', 'lodashTool']);
    });
  }

  describe('dev', async () => {
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

      await new Promise<void>(resolve => {
        proc!.stdout?.on('data', data => {
          process.stdout.write(data?.toString());
          if (data?.toString()?.includes(`http://localhost:${port}`)) {
            resolve();
          }
        });
      });
    }, timeout);

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

    runApiTests(port);
  });

  describe('build', async () => {
    let port = await getPort();
    let proc: ReturnType<typeof execa> | undefined;
    const controller = new AbortController();
    const cancelSignal = controller.signal;

    beforeAll(async () => {
      const inputFile = join(fixturePath, 'apps', 'custom', '.mastra', 'output');
      proc = execaNode('index.mjs', {
        cwd: inputFile,
        cancelSignal,
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
    }, timeout);

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

    runApiTests(port);
  });

  describe.skip('start', async () => {
    let port = await getPort();
    let proc: ReturnType<typeof execa> | undefined;
    const controller = new AbortController();
    const cancelSignal = controller.signal;

    beforeAll(async () => {
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

      await new Promise<void>(resolve => {
        proc!.stdout?.on('data', data => {
          console.log(data?.toString());
          if (data?.toString()?.includes(`http://localhost:${port}`)) {
            resolve();
          }
        });
      });
    }, timeout);

    afterAll(async () => {
      if (proc) {
        try {
          setImmediate(() => controller.abort());
          await proc;
        } catch (err) {
          // @ts-expect-error - isCanceled is not typed
          if (!err.isCanceled) {
            console.log('failed to kill start proc', err);
          }
        }
      }
    }, timeout);

    runApiTests(port);
  });
});
