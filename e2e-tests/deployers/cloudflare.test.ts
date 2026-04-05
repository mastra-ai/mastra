import { it, describe, expect, beforeAll, afterAll, inject } from 'vitest';
import { join } from 'path';
import { setupDeployerProject } from './prepare';
import { mkdtemp, rm, readFile } from 'fs/promises';
import { tmpdir } from 'os';
import getPort from 'get-port';
import { execa, execaNode } from 'execa';

const timeout = 5 * 60 * 1000;

describe.for([['pnpm'] as const])(`%s cloudflare deployer`, ([pkgManager]) => {
  let fixturePath: string;

  beforeAll(
    async () => {
      const tag = inject('tag');
      const registry = inject('registry');

      fixturePath = await mkdtemp(join(tmpdir(), `mastra-cloudflare-deployer-test-${pkgManager}-`));
      process.env.npm_config_registry = registry;
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

  function runApiTests(port: number) {
    it('should resolve api routes', async () => {
      const res = await fetch(`http://localhost:${port}/test`);
      const text = await res.text();
      // Extract body content (skip CSS/head) to see actual error
      const bodyMatch = text.match(/<body[^>]*>([\s\S]*)<\/body>/i);
      console.log(`[DEBUG] GET /test status=${res.status} body-content=${bodyMatch?.[1]?.slice(0, 3000) ?? text.slice(-2000)}`);
      const body = JSON.parse(text);
      expect(res.status).toBe(200);
      expect(body).toEqual({ message: 'Hello, world!' });
    });
    it('should return tools from the api', async () => {
      const res = await fetch(`http://localhost:${port}/api/tools`);
      const text = await res.text();
      const bodyMatch = text.match(/<body[^>]*>([\s\S]*)<\/body>/i);
      console.log(`[DEBUG] GET /api/tools status=${res.status} body-content=${bodyMatch?.[1]?.slice(0, 3000) ?? text.slice(-2000)}`);
      const body = JSON.parse(text);
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

      // Debug: dump build output
      try {
        const { readdirSync } = await import('fs');
        console.log(`[DEBUG] output dir: ${readdirSync(workerDir).join(', ')}`);
        const pkg = await readFile(join(workerDir, 'package.json'), 'utf-8');
        console.log(`[DEBUG] package.json: ${pkg}`);
        const entry = await readFile(join(workerDir, 'index.mjs'), 'utf-8');
        console.log(`[DEBUG] index.mjs (first 3000 chars):\n${entry.slice(0, 3000)}`);
        const wranglerCfg = await readFile(join(workerDir, 'wrangler.json'), 'utf-8');
        console.log(`[DEBUG] wrangler.json: ${wranglerCfg}`);
        if (readdirSync(workerDir).includes('node_modules')) {
          const nmTop = readdirSync(join(workerDir, 'node_modules'));
          console.log(`[DEBUG] node_modules: ${nmTop.join(', ')}`);
        }
      } catch (e) {
        console.log(`[DEBUG] error reading output: ${e}`);
      }

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
});
