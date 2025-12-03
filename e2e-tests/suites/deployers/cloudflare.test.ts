import { describe, it, expect, beforeAll, afterAll, inject } from 'vitest';
import { join } from 'node:path';
import { rm } from 'node:fs/promises';
import getPort from 'get-port';
import { execa } from 'execa';
import { createProject, type TestProject } from '../../_shared/setup/project.js';
import { waitForServer, waitForOutput } from '../../_shared/utils/server-ready.js';
import { processManager } from '../../_shared/utils/cleanup.js';
import { spawnSync } from 'node:child_process';

const TEST_TIMEOUT = 5 * 60 * 1000;
const BUILD_TIMEOUT = 3 * 60 * 1000;

describe.for([['pnpm'] as const])('%s cloudflare deployer', ([pkgManager]) => {
  let project: TestProject;
  let testRegistryUrl: string;

  beforeAll(
    async () => {
      testRegistryUrl = inject('registryUrl');

      project = await createProject({
        template: 'cloudflare',
        namePrefix: `mastra-cloudflare-deployer-test-${pkgManager}`,
        registryUrl: testRegistryUrl,
        packageManager: pkgManager,
      });

      // Build with mastra
      console.log('[cloudflare] Building mastra...');
      const buildResult = spawnSync('pnpm', ['exec', 'mastra', 'build'], {
        cwd: project.path,
        stdio: 'inherit',
        shell: true,
        env: {
          ...process.env,
          npm_config_registry: testRegistryUrl,
          MASTRA_BUNDLER_DEBUG: 'true',
        },
        timeout: BUILD_TIMEOUT,
      });

      if (buildResult.error) {
        throw new Error(`Build failed: ${buildResult.error.message}`);
      }
      if (buildResult.status !== 0) {
        throw new Error(`Build failed with exit code ${buildResult.status}`);
      }
    },
    10 * 60 * 1000,
  );

  afterAll(async () => {
    await project?.cleanup();
  });

  function runApiTests(port: number) {
    it('should resolve api routes', async () => {
      const res = await fetch(`http://localhost:${port}/test`);
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body).toEqual({ message: 'Hello, world!' });
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

    beforeAll(async () => {
      const workerDir = join(project.path, '.mastra', 'output');

      proc = execa('npx', ['wrangler', 'dev', '--port', port.toString()], {
        cwd: workerDir,
        cancelSignal: controller.signal,
        gracefulCancel: true,
        env: process.env,
      });

      processManager.register({
        process: proc,
        name: 'wrangler-dev',
      });

      // Wait for wrangler to be ready
      await waitForOutput({
        stream: proc.stdout!,
        pattern: `http://localhost:${port}`,
        timeout: 60_000,
      });
    }, TEST_TIMEOUT);

    afterAll(async () => {
      if (proc) {
        try {
          proc.kill('SIGKILL');
        } catch {
          // Process might already be killed
        }
        processManager.unregister(proc);
      }
    }, TEST_TIMEOUT);

    runApiTests(port);
  });
});
