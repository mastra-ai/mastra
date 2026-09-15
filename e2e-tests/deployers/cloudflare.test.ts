import { it, describe, expect, beforeAll, afterAll, inject } from 'vitest';
import { join } from 'path';
import { setupDeployerProject } from './prepare';
import { mkdtemp, rm, readFile } from 'fs/promises';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import getPort from 'get-port';
import { execa } from 'execa';

const timeout = 5 * 60 * 1000;

describe.for([['pnpm'] as const])(`%s cloudflare deployer`, ([pkgManager]) => {
  let fixturePath: string;

  beforeAll(
    async () => {
      const tag = inject('tag');
      const registry = inject('registry');

      fixturePath = await mkdtemp(join(tmpdir(), `mastra-cloudflare-deployer-test-${pkgManager}-`));
      process.env.pnpm_config_registry = registry;
      await setupDeployerProject(fixturePath, tag, pkgManager, 'cloudflare');
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

  async function assertAppIsReused(baseUrl: string) {
    let first: Response;
    let second: Response;
    let firstText: string;
    let secondText: string;

    const deadline = Date.now() + 60_000;
    do {
      [first, second] = await Promise.all([fetch(`${baseUrl}/test`), fetch(`${baseUrl}/test`)]);
      [firstText, secondText] = await Promise.all([first.text(), second.text()]);

      if (first.status !== 404 && second.status !== 404) break;
      await new Promise(resolve => setTimeout(resolve, 1_000));
    } while (Date.now() < deadline);

    expect(first.status, firstText).toBe(200);
    expect(second.status, secondText).toBe(200);

    const firstBody = JSON.parse(firstText) as {
      message: string;
      initializationCount: number;
      instanceId: string;
    };
    const secondBody = JSON.parse(secondText) as typeof firstBody;
    expect(firstBody).toEqual({
      message: 'Hello, world!',
      initializationCount: 1,
      instanceId: expect.any(String),
    });
    expect(secondBody).toEqual(firstBody);

    const third = await fetch(`${baseUrl}/test`);
    expect(await third.json()).toEqual(firstBody);
  }

  async function assertDeployedAppIsHealthy(baseUrl: string) {
    const responses: Array<{ initializationCount: number; instanceId: string }> = [];
    const deadline = Date.now() + 60_000;

    while (responses.length < 20 && Date.now() < deadline) {
      const response = await fetch(`${baseUrl}/test`);
      const text = await response.text();

      if (response.status === 404) {
        await new Promise(resolve => setTimeout(resolve, 1_000));
        continue;
      }

      expect(response.status, text).toBe(200);
      responses.push(JSON.parse(text));
    }

    expect(responses).toHaveLength(20);
    expect(responses.every(response => response.initializationCount === 1)).toBe(true);
    expect(responses.every(response => response.instanceId.length > 0)).toBe(true);
  }

  function runApiTests(port: number) {
    it('reuses one Mastra app for concurrent and sequential requests', async () => {
      await assertAppIsReused(`http://localhost:${port}`);
    });

    it('should return tools from the api', async () => {
      const res = await fetch(`http://localhost:${port}/api/tools`);
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(Object.keys(body)).toEqual(['weatherTool']);
    });
  }

  describe('wrangler dev', async () => {
    const port = await getPort();
    let proc: ReturnType<typeof execa> | undefined;
    const controller = new AbortController();
    const cancelSignal = controller.signal;
    let sawPortOutput = false;

    beforeAll(async () => {
      const workerDir = join(fixturePath, '.mastra', 'output');

      proc = execa('npx', ['wrangler', 'dev', '--port', port.toString()], {
        cwd: workerDir,
        cancelSignal,
        gracefulCancel: true,
        env: process.env,
      });

      await new Promise<void>((resolve, reject) => {
        const onStdout = (data: unknown) => {
          const text = (data as any)?.toString?.();
          if (text) {
            process.stdout.write(text);
            if (text.includes(`http://localhost:${port}`)) {
              cleanup();
              resolve();
            }
          }
        };

        const onStderr = (data: unknown) => {
          const text = (data as any)?.toString?.();
          if (text) {
            console.error(text);
          }
        };

        const onExit = (code: number | null, signal: NodeJS.Signals | null) => {
          const message = `wrangler dev exited before ready (code: ${code}, signal: ${signal})`;
          cleanup();
          reject(new Error(message));
        };

        const onError = (err: unknown) => {
          cleanup();
          reject(err instanceof Error ? err : new Error(String(err)));
        };

        const cleanup = () => {
          clearTimeout(timeoutId);
          proc!.stdout?.off('data', onStdout);
          proc!.stderr?.off('data', onStderr);
          proc!.off('exit', onExit);
          proc!.off('error', onError);
        };

        const timeoutId = setTimeout(() => {
          cleanup();
          reject(new Error(`Timed out waiting for wrangler dev to start on port ${port}`));
        }, 60_000);

        proc!.stdout?.on('data', onStdout);
        proc!.stderr?.on('data', onStderr);
        proc!.on('exit', onExit);
        proc!.on('error', onError);
      });
    }, timeout);

    afterAll(async () => {
      if (proc) {
        try {
          proc.kill('SIGKILL');
        } catch (err) {
          if (!(err as any).killed) {
            console.log('failed to kill wrangler dev proc', err);
          }
        }
      }
    }, timeout);

    runApiTests(port);
  });

  describe.runIf(process.env.MASTRA_CLOUDFLARE_DEPLOY_SMOKE === '1')('deployed worker', () => {
    const workerName = `mastra-isolate-smoke-${randomUUID().slice(0, 8)}`;
    let workerDir: string;

    afterAll(async () => {
      if (!workerDir) return;

      await execa('npx', ['wrangler', 'delete', '--name', workerName, '--force'], {
        cwd: workerDir,
        env: process.env,
        reject: false,
      });
    }, timeout);

    it(
      'serves the initialized Mastra app from deployed Cloudflare isolates',
      async () => {
        workerDir = join(fixturePath, '.mastra', 'output');
        const deployment = await execa('npx', ['wrangler', 'deploy', '--name', workerName], {
          cwd: workerDir,
          env: process.env,
        });
        const workerUrl = deployment.stdout.match(/https:\/\/[^\s]+\.workers\.dev/)?.[0];

        expect(workerUrl, `Could not find the deployed Worker URL in:\n${deployment.stdout}`).toBeDefined();
        await assertDeployedAppIsHealthy(workerUrl!);
      },
      timeout,
    );
  });
});
