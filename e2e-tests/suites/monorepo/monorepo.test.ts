import { describe, it, expect, beforeAll, afterAll, inject } from 'vitest';
import { join } from 'node:path';
import { mkdtemp, rm, readFile, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import getPort from 'get-port';
import { execa, execaNode } from 'execa';
import { createProject, type TestProject } from '../../_shared/setup/project.js';
import { waitForServer } from '../../_shared/utils/server-ready.js';
import { processManager, cleanupTempDirs } from '../../_shared/utils/cleanup.js';

const TEST_TIMEOUT = 5 * 60 * 1000;

describe.for([['pnpm'] as const])('%s monorepo', ([pkgManager]) => {
  let project: TestProject;

  async function runBuild() {
    await execa(pkgManager, ['build'], {
      cwd: join(project.path, 'apps', 'custom'),
      stdio: 'inherit',
      env: process.env,
    });
  }

  beforeAll(
    async () => {
      const registryUrl = inject('registryUrl');

      project = await createProject({
        template: 'monorepo',
        namePrefix: `mastra-monorepo-test-${pkgManager}`,
        registryUrl,
        packageManager: pkgManager,
      });

      // Temporary fix for copilotkit runtime-context export
      const corePath = join(project.path, 'apps', 'custom', 'node_modules', '@mastra', 'core', 'dist');
      await mkdir(join(corePath, 'runtime-context'), { recursive: true });
      await writeFile(
        join(corePath, 'runtime-context', 'index.js'),
        `export { RequestContext as RuntimeContext } from '../request-context/index.js';`,
      );
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
      expect(body).toEqual({ message: 'Hello, world!', a: 'b' });
    });

    it('should resolve api ALL routes', async () => {
      let res = await fetch(`http://localhost:${port}/all`);
      let body = await res.json();
      expect(res.status).toBe(200);
      expect(body).toEqual({ message: 'Hello, GET!' });

      res = await fetch(`http://localhost:${port}/all`, { method: 'POST' });
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

  describe.sequential('dev', async () => {
    const port = await getPort();
    let proc: ReturnType<typeof execa> | undefined;
    const controller = new AbortController();

    beforeAll(async () => {
      const inputFile = join(project.path, 'apps', 'custom');

      proc = execa('npm', ['run', 'dev'], {
        cwd: inputFile,
        cancelSignal: controller.signal,
        gracefulCancel: true,
        env: {
          OPENAI_API_KEY: process.env.OPENAI_API_KEY,
          MASTRA_PORT: port.toString(),
        },
      });

      processManager.register({
        process: proc,
        name: 'monorepo-dev',
      });

      // Use robust server wait utility
      await waitForServer({
        url: `http://localhost:${port}/api/tools`,
        timeout: 60_000,
        onAttempt: (attempt, error) => {
          if (attempt % 10 === 0) {
            console.log(`[dev] Waiting for server... attempt ${attempt}`);
          }
        },
      });
    }, TEST_TIMEOUT);

    afterAll(async () => {
      if (proc) {
        try {
          proc.kill('SIGKILL');
          processManager.unregister(proc);
        } catch (err) {
          // Process might already be killed
        }
      }
    }, TEST_TIMEOUT);

    runApiTests(port);
  });

  describe.sequential('build', async () => {
    const port = await getPort();
    let proc: ReturnType<typeof execaNode> | undefined;
    const controller = new AbortController();

    beforeAll(async () => {
      await runBuild();

      const inputFile = join(project.path, 'apps', 'custom', '.mastra', 'output');

      proc = execaNode('index.mjs', {
        cwd: inputFile,
        cancelSignal: controller.signal,
        env: {
          OPENAI_API_KEY: process.env.OPENAI_API_KEY,
          MASTRA_PORT: port.toString(),
        },
      });

      processManager.register({
        process: proc,
        name: 'monorepo-build',
      });

      await waitForServer({
        url: `http://localhost:${port}/api/tools`,
        timeout: 60_000,
      });
    }, TEST_TIMEOUT);

    it('should resolve tsconfig paths', async () => {
      const inputFile = join(project.path, 'apps', 'custom', '.mastra', 'output', 'index.mjs');
      const content = await readFile(inputFile, 'utf-8');
      const hasMappedPkg = content.includes('@/agents');
      expect(hasMappedPkg).toBeFalsy();
    });

    afterAll(async () => {
      if (proc) {
        try {
          setImmediate(() => controller.abort());
          await proc;
        } catch {
          // Expected when aborting
        }
        processManager.unregister(proc);
      }
    }, TEST_TIMEOUT);

    runApiTests(port);
  });

  describe.sequential('start', async () => {
    const port = await getPort();
    let proc: ReturnType<typeof execa> | undefined;
    const controller = new AbortController();

    beforeAll(async () => {
      await runBuild();

      const inputFile = join(project.path, 'apps', 'custom');

      proc = execa('npm', ['run', 'start'], {
        cwd: inputFile,
        cancelSignal: controller.signal,
        gracefulCancel: true,
        env: {
          OPENAI_API_KEY: process.env.OPENAI_API_KEY,
          MASTRA_PORT: port.toString(),
        },
      });

      processManager.register({
        process: proc,
        name: 'monorepo-start',
      });

      await waitForServer({
        url: `http://localhost:${port}/api/tools`,
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
