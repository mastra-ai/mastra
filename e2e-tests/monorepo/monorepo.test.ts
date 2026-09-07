import { it, describe, expect, beforeAll, afterAll, inject } from 'vitest';
import { join } from 'path';
import { setupMonorepo } from './prepare';
import { mkdtemp, mkdir, readdir, rm, readFile, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import getPort from 'get-port';
import { execa, execaNode } from 'execa';

const timeout = 5 * 60 * 1000;

/**
 * Killing the `npm run dev` wrapper orphans the `mastra dev` grandchild, which
 * keeps running and holds `.mastra/dev.lock`. `mastra build` refuses to build
 * while that lock names a live pid, so later build suites in this file fail
 * with "A `mastra dev` server is running in this directory" unless the real
 * dev server is killed and the lock removed.
 */
async function killOrphanedDevServer(projectDir: string) {
  const lockPath = join(projectDir, '.mastra', 'dev.lock');
  try {
    const { pid } = JSON.parse(await readFile(lockPath, 'utf-8'));
    if (typeof pid !== 'number' || pid <= 0) return;
    try {
      process.kill(pid, 'SIGKILL');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ESRCH') return;
    }
    await rm(lockPath, { force: true });
  } catch {}
}

const activeProcesses: Array<{ controller: AbortController; proc: ReturnType<typeof execa | typeof execaNode> }> = [];

async function cleanupAllProcesses() {
  for (const { controller, proc } of activeProcesses) {
    try {
      controller.abort();
      proc.kill('SIGKILL');
      await Promise.race([proc.catch(() => {}), new Promise(resolve => setTimeout(resolve, 5_000))]);
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

describe.sequential.for([['pnpm'] as const])(`%s monorepo`, ([pkgManager]) => {
  let fixturePath: string;

  let buildQueue: Promise<unknown> = Promise.resolve();

  async function removeOutputDir(path: string) {
    const outputDir = join(path, 'apps', 'custom', '.mastra', 'output');
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        await rm(outputDir, { recursive: true, force: true });
        return;
      } catch (err) {
        if (attempt === 4) {
          throw err;
        }
        await new Promise(resolve => setTimeout(resolve, 1_000));
      }
    }
  }

  async function runBuild(path: string) {
    const build = buildQueue.then(async () => {
      await removeOutputDir(path);
      return execa(pkgManager, ['build'], {
        cwd: join(path, 'apps', 'custom'),
        stdio: 'inherit',
        env: process.env,
      });
    });
    buildQueue = build.catch(() => {});
    await build;
  }

  beforeAll(
    async () => {
      const registry = inject('registry');

      fixturePath = await mkdtemp(join(tmpdir(), `mastra-monorepo-test-${pkgManager}-`));
      process.env.pnpm_config_registry = registry;
      await setupMonorepo(fixturePath, pkgManager);

      // fix temporary 0.x patch for copilotkit
      const corePath = join(fixturePath, 'apps', 'custom', 'node_modules', '@mastra', 'core', 'dist');
      await mkdir(join(corePath, 'runtime-context'), { recursive: true });
      await writeFile(
        join(corePath, 'runtime-context', 'index.js'),
        `export { RequestContext as RuntimeContext } from '../request-context/index.js';`,
      );
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
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body).toEqual({ message: 'Hello, world!', a: 'b' });
    });

    it('should resolve createRoute api routes', async () => {
      const res = await fetch(`http://localhost:${port}/create-route`);
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body).toEqual({ message: 'Hello from createRoute!' });
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

    it('should resolve transitive workspace dependencies', async () => {
      const res = await fetch(`http://localhost:${port}/transitive-workspace`);
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body).toEqual({ value: 'a -> b -> c', app: 'App value is BEFORE.' });
    });

    it('reports hasBrowser for an agent with a workspace-level CLI browser', async () => {
      const res = await fetch(`http://localhost:${port}/api/agents/browser-agent`);
      const body = await res.json();
      expect(res.status).toBe(200);
      // CLI providers expose no SDK tools; the capability must come from the workspace browser.
      expect(body.browserTools).toEqual([]);
      expect(body.hasBrowser).toBe(true);
    });

    it('reports hasBrowser false for an agent without a browser', async () => {
      const res = await fetch(`http://localhost:${port}/api/agents/inner-agent`);
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body.hasBrowser).toBe(false);
    });

    it('serves the browser session probe with screencast available', async () => {
      const res = await fetch(`http://localhost:${port}/api/agents/browser-agent/browser/session`);
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body).toEqual({ hasSession: false, screencastAvailable: true });
    });

    it('should return tools from the api', async () => {
      const res = await fetch(`http://localhost:${port}/api/tools`);
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(Object.keys(body).sort()).toEqual(
        ['calculatorTool', 'lodashTool', 'hello-world', 'generate-password', 'compare-password'].sort(),
      );
    });
  }

  describe.sequential('dev', async () => {
    let port = await getPort();
    let proc: ReturnType<typeof execa> | undefined;
    const controller = new AbortController();
    const cancelSignal = controller.signal;

    beforeAll(async () => {
      const inputFile = join(fixturePath, 'apps', 'custom');
      const mastraIndexPath = join(inputFile, 'src', 'mastra', 'index.ts');
      const mastraIndex = (await readFile(mastraIndexPath, 'utf8'))
        .replace(
          "import { testRoute } from '@/api/route/test';",
          "import { testRoute } from '@/api/route/test';\nimport { environmentRoute } from '@/api/route/environment';",
        )
        .replace('apiRoutes: [testRoute,', 'apiRoutes: [testRoute, environmentRoute,');
      await Promise.all([
        writeFile(mastraIndexPath, mastraIndex),
        writeFile(join(inputFile, '.env'), 'BASE_ONLY=base\nSHARED=base\n'),
        writeFile(join(inputFile, '.env.local'), 'LOCAL_ONLY=local\nSHARED=local\n'),
        writeFile(join(inputFile, '.env.development'), 'ENVIRONMENT_ONLY=development\n'),
        writeFile(join(inputFile, '.env.production'), 'ENVIRONMENT_ONLY=production\n'),
        writeFile(
          join(inputFile, 'src', 'mastra', 'api', 'route', 'environment.ts'),
          `import { registerApiRoute } from '@mastra/core/server';

export const environmentRoute = registerApiRoute('/environment', {
  method: 'GET',
  handler: async c => c.json({
    base: process.env.BASE_ONLY,
    local: process.env.LOCAL_ONLY,
    environment: process.env.ENVIRONMENT_ONLY,
    shared: process.env.SHARED,
  }),
});
`,
        ),
      ]);
      proc = execa('mastra', ['dev'], {
        cwd: inputFile,
        preferLocal: true,
        cancelSignal,
        gracefulCancel: true,
        env: {
          OPENAI_API_KEY: process.env.OPENAI_API_KEY,
          MASTRA_PORT: port.toString(),
          SHARED: 'shell',
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
          if (errMsg && errMsg.includes('falling back to an in-memory store')) {
            // Ignore in-memory storage fallback warning (no storage configured in fixture)
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

    afterAll(async () => {
      if (proc) {
        try {
          controller.abort();
          await Promise.race([proc.catch(() => {}), new Promise(resolve => setTimeout(resolve, 5_000))]);
        } catch (err) {
          // @ts-expect-error - isCanceled is not typed
          if (!err.isCanceled) {
            console.log('failed to kill dev proc', err);
          }
        }
      }
      await killOrphanedDevServer(join(fixturePath, 'apps', 'custom'));
    }, timeout);

    runApiTests(port);

    it('layers development dotenv files without overriding the shell environment', async () => {
      const res = await fetch(`http://localhost:${port}/environment`);

      await expect(res.json()).resolves.toEqual({
        base: 'base',
        local: 'local',
        environment: 'development',
        shared: 'shell',
      });
    });

    it(
      'hot-reloads workspace package changes without a full process restart',
      async () => {
        const packageSource = join(fixturePath, 'packages', 'transitive-c', 'src', 'index.js');
        const appRoute = join(
          fixturePath,
          'apps',
          'custom',
          'src',
          'mastra',
          'api',
          'route',
          'transitive-workspace.ts',
        );

        const originalPackageSource = await readFile(packageSource, 'utf-8');
        const originalAppRoute = await readFile(appRoute, 'utf-8');

        const waitForReload = async (predicate: (body: { value: string; app: string }) => boolean) => {
          const started = Date.now();
          let lastBody: { value: string; app: string } | undefined;
          while (Date.now() - started < 60_000) {
            try {
              const res = await fetch(`http://localhost:${port}/transitive-workspace`);
              if (res.ok) {
                lastBody = (await res.json()) as { value: string; app: string };
                if (predicate(lastBody)) {
                  return lastBody;
                }
              }
            } catch {
              // Server may be restarting.
            }
            await new Promise(resolve => setTimeout(resolve, 500));
          }
          throw new Error(`Timed out waiting for hot reload. Last body: ${JSON.stringify(lastBody)}`);
        };

        try {
          // 1. Baseline
          const baseline = await waitForReload(
            body => body.value === 'a -> b -> c' && body.app === 'App value is BEFORE.',
          );
          expect(baseline).toEqual({ value: 'a -> b -> c', app: 'App value is BEFORE.' });

          // 2. Edit workspace package only
          await writeFile(packageSource, `export const valueC = 'c-AFTER';\n`);
          const afterPackage = await waitForReload(
            body => body.value === 'a -> b -> c-AFTER' && body.app === 'App value is BEFORE.',
          );
          expect(afterPackage).toEqual({ value: 'a -> b -> c-AFTER', app: 'App value is BEFORE.' });

          // 3. Edit app only — package AFTER must still be present (no stale optimizer cache)
          await writeFile(appRoute, originalAppRoute.replace('App value is BEFORE.', 'App value is AFTER.'));
          const afterApp = await waitForReload(
            body => body.value === 'a -> b -> c-AFTER' && body.app === 'App value is AFTER.',
          );
          expect(afterApp).toEqual({ value: 'a -> b -> c-AFTER', app: 'App value is AFTER.' });
        } finally {
          // Restore fixture so subsequent build/start suites see the original sources.
          await writeFile(packageSource, originalPackageSource);
          await writeFile(appRoute, originalAppRoute);
        }
      },
      timeout,
    );
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
          if (errMsg && errMsg.includes('falling back to an in-memory store')) {
            // Ignore in-memory storage fallback warning (no storage configured in fixture)
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

    it('should resolve tsconfig paths', async () => {
      const inputFile = join(fixturePath, 'apps', 'custom', '.mastra', 'output', 'index.mjs');
      const content = await readFile(inputFile, 'utf-8');

      const hasMappedPkg = content.includes('@/agents');

      expect(hasMappedPkg).toBeFalsy();
    });

    it('should resolve workspace package tsconfig paths', async () => {
      const inputFile = join(fixturePath, 'apps', 'custom', '.mastra', 'output', 'index.mjs');
      const content = await readFile(inputFile, 'utf-8');

      // Verify that the path alias ~/utils is resolved and not present in the bundled output
      const hasWorkspaceMappedPath = content.includes('~/utils');

      expect(hasWorkspaceMappedPath).toBeFalsy();
    });

    it('should keep deprecated externals out of optimized dependency bundles', async () => {
      const outputDir = join(fixturePath, 'apps', 'custom', '.mastra', 'output');
      const outputFiles = await readdir(outputDir);
      const output = (
        await Promise.all(
          outputFiles.filter(file => file.endsWith('.mjs')).map(file => readFile(join(outputDir, file), 'utf-8')),
        )
      ).join('\n');
      const packageJson = JSON.parse(await readFile(join(outputDir, 'package.json'), 'utf-8'));

      expect(outputFiles).not.toContain('nodemailer.mjs');
      expect(output).not.toContain('nodemailer/lib');
      expect(packageJson.dependencies?.nodemailer).toBe('^9.0.1');
    });

    // This stays in the monorepo E2E suite because it builds the generated fixture and validates its output manifest.
    it('should keep default and user-configured externals in the output manifest', async () => {
      const packageJsonPath = join(fixturePath, 'apps', 'custom', '.mastra', 'output', 'package.json');
      const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf-8'));

      expect(packageJson.dependencies).toEqual(
        expect.objectContaining({
          '@mastra/core': expect.any(String),
          bcrypt: expect.any(String),
          typescript: expect.any(String),
        }),
      );
    });

    it('should emit a worker runtime entry with a readiness endpoint', async () => {
      const workerEntryPath = join(fixturePath, 'apps', 'custom', '.mastra', 'output', 'worker.mjs');
      const workerEntry = await readFile(workerEntryPath, 'utf-8');

      expect(workerEntry).toContain('/health');
      expect(workerEntry).toContain('startWorkers');
    });

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
          await Promise.race([proc.catch(() => {}), new Promise(resolve => setTimeout(resolve, 5_000))]);
        } catch (err) {
          // @ts-expect-error - isCanceled is not typed
          if (!err.isCanceled) {
            console.log('failed to kill start proc', err);
          }
        }
      }
    }, timeout);

    runApiTests(port);

    it(
      'drains an in-flight response before the generated server exits on SIGTERM',
      async () => {
        // Run the built server directly and signal it directly. Going through
        // `npm run start` (npm -> sh -> mastra CLI -> node) is not a reliable
        // signal chain on CI runners: the SIGTERM sent to npm never reached
        // the server, the stream never ended, and the test hung until its
        // timeout. CLI signal forwarding is covered by unit tests in
        // packages/cli/src/commands/start/start.test.ts; the behavior under
        // test here is the generated server's graceful drain.
        const drainPort = await getPort();
        const outputDir = join(fixturePath, 'apps', 'custom', '.mastra', 'output');
        const drainController = new AbortController();
        const server = execaNode('index.mjs', {
          cwd: outputDir,
          cancelSignal: drainController.signal,
          env: {
            OPENAI_API_KEY: process.env.OPENAI_API_KEY,
            MASTRA_PORT: drainPort.toString(),
          },
        });
        activeProcesses.push({ controller: drainController, proc: server });

        try {
          // Poll the server until it's ready
          const maxAttempts = 60;
          for (let i = 0; i < maxAttempts; i++) {
            try {
              const res = await fetch(`http://localhost:${drainPort}/api/tools`);
              if (res.ok) break;
            } catch {
              // Server not ready yet
            }
            if (i === maxAttempts - 1) {
              throw new Error('Drain test server failed to start within timeout');
            }
            await new Promise(resolve => setTimeout(resolve, 1000));
          }

          const response = await fetch(`http://localhost:${drainPort}/shutdown-drain`);
          const reader = response.body!.getReader();
          const decoder = new TextDecoder();
          const firstChunk = await reader.read();
          expect(decoder.decode(firstChunk.value)).toBe('started\n');

          server.kill('SIGTERM');

          let remaining = '';
          while (true) {
            const chunk = await reader.read();
            if (chunk.done) break;
            remaining += decoder.decode(chunk.value, { stream: true });
          }

          expect(remaining).toBe('finished\n');
          await expect(server).resolves.toMatchObject({ exitCode: 0 });
          // Full shutdown includes the drain window plus core teardown; the vitest
          // default 5s timeout is tighter than the server's own worst-case bounds.
        } finally {
          // Never leave the drain server running if an assertion failed.
          server.kill('SIGKILL');
          await Promise.race([server.catch(() => {}), new Promise(resolve => setTimeout(resolve, 5_000))]);
        }
      },
      timeout,
    );
  });

  describe.sequential('build without externals', async () => {
    let originalConfig: string;
    let port = await getPort();
    let proc: ReturnType<typeof execaNode> | undefined;
    const controller = new AbortController();
    const cancelSignal = controller.signal;
    const mastraConfigPath = () => join(fixturePath, 'apps', 'custom', 'src', 'mastra', 'index.ts');

    beforeAll(async () => {
      // Read and backup the original config
      originalConfig = await readFile(mastraConfigPath(), 'utf-8');

      // Remove the bundler.externals config to test automatic version resolution
      const modifiedConfig = originalConfig.replace(/,?\s*bundler:\s*\{\s*externals:\s*\[[^\]]*\],?\s*\}/m, '');
      await writeFile(mastraConfigPath(), modifiedConfig);

      // Run build with modified config (no bundler.externals)
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
            return;
          }
          if (errMsg && errMsg.includes('falling back to an in-memory store')) {
            return;
          }

          reject(new Error('failed to start without externals: ' + errMsg));
        });
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
            console.log('failed to kill build without externals proc', err);
          }
        }
      }

      // Restore original config
      await writeFile(mastraConfigPath(), originalConfig);
    });

    runApiTests(port);

    it('should resolve dependency versions correctly (not "latest")', async () => {
      const packageJsonPath = join(fixturePath, 'apps', 'custom', '.mastra', 'output', 'package.json');
      const content = await readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(content);

      const dependencies = packageJson.dependencies || {};

      // Check that no dependencies have 'latest' as version
      const latestDeps = Object.entries(dependencies).filter(([, version]) => version === 'latest');
      expect(latestDeps).toEqual([]);

      // Verify specific packages have proper semver versions (not 'latest')
      // These are packages that should be resolved from the monorepo or deployer
      const packagesToCheck = ['hono', 'lodash', 'date-fns', 'zod'];
      for (const pkg of packagesToCheck) {
        if (dependencies[pkg]) {
          expect(dependencies[pkg]).not.toBe('latest');
          // Should be a semver version (starts with a digit or ^, ~, etc.)
          expect(dependencies[pkg]).toMatch(/^[\d^~>=<]/);
        }
      }

      // Automatic version resolution must read the copy installed for the app (0.4.0),
      // not the older copy installed at the workspace root (0.2.0) (#18849).
      expect(dependencies['unicorn-magic']).toBe('0.4.0');
    });
  });

  describe.sequential('subpath-only externals', () => {
    it(
      'should build transitive workspace dependencies with subpath-only exports and externals true',
      async () => {
        const isolatedFixturePath = await mkdtemp(join(tmpdir(), `mastra-monorepo-subpath-test-${pkgManager}-`));
        await setupMonorepo(isolatedFixturePath, pkgManager);

        const corePath = join(isolatedFixturePath, 'apps', 'custom', 'node_modules', '@mastra', 'core', 'dist');
        await mkdir(join(corePath, 'runtime-context'), { recursive: true });
        await writeFile(
          join(corePath, 'runtime-context', 'index.js'),
          `export { RequestContext as RuntimeContext } from '../request-context/index.js';`,
        );

        const mastraConfigPath = join(isolatedFixturePath, 'apps', 'custom', 'src', 'mastra', 'index.ts');
        const originalMastraConfig = await readFile(mastraConfigPath, 'utf-8');

        const port = await getPort();
        const controller = new AbortController();
        let proc: ReturnType<typeof execaNode> | undefined;

        try {
          await writeFile(mastraConfigPath, originalMastraConfig.replace(/externals:\s*\[[^\]]*\]/, 'externals: true'));

          await runBuild(isolatedFixturePath);

          proc = execaNode('index.mjs', {
            cwd: join(isolatedFixturePath, 'apps', 'custom', '.mastra', 'output'),
            cancelSignal: controller.signal,
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
                return;
              }
              if (errMsg && errMsg.includes('falling back to an in-memory store')) {
                return;
              }
              reject(new Error('failed to start subpath-only externals build: ' + errMsg));
            });
            proc!.stdout?.on('data', data => {
              console.log(data?.toString());
              if (data?.toString()?.includes(`http://localhost:${port}`)) {
                resolve();
              }
            });
          });

          const res = await fetch(`http://localhost:${port}/transitive-workspace`);
          const body = await res.json();
          expect(res.status).toBe(200);
          expect(body).toEqual({ value: 'a -> b -> c', app: 'App value is BEFORE.' });
        } finally {
          if (proc) {
            try {
              setImmediate(() => controller.abort());
              await proc;
            } catch (err) {
              // @ts-expect-error - isCanceled is not typed
              if (!err.isCanceled) {
                console.log('failed to kill subpath-only externals build proc', err);
              }
            }
          }

          await writeFile(mastraConfigPath, originalMastraConfig);
          await rm(isolatedFixturePath, { recursive: true, force: true });
        }
      },
      timeout,
    );
  });

  describe.sequential('pnpm build approvals', () => {
    it(
      'reports blocked native build scripts as a user configuration error',
      async () => {
        const isolatedFixturePath = await mkdtemp(join(tmpdir(), `mastra-monorepo-build-approval-test-${pkgManager}-`));
        try {
          await setupMonorepo(isolatedFixturePath, pkgManager);
          const workspacePath = join(isolatedFixturePath, 'pnpm-workspace.yaml');
          const workspace = await readFile(workspacePath, 'utf8');
          await writeFile(workspacePath, workspace.replace('  bcrypt: true\n', ''));

          await removeOutputDir(isolatedFixturePath);
          const build = await execa(pkgManager, ['build'], {
            cwd: join(isolatedFixturePath, 'apps', 'custom'),
            env: process.env,
            reject: false,
          });
          const output = `${build.stdout}\n${build.stderr}`;

          expect(build.exitCode).not.toBe(0);
          expect(output).toContain('pnpm blocked build scripts for: bcrypt');
          expect(output).toContain('Add these packages to allowBuilds in pnpm-workspace.yaml and retry the build.');
          expect(output).not.toContain('DEPLOYER_BUNDLER_BUNDLE_STAGE_FAILED');
        } finally {
          await rm(isolatedFixturePath, { recursive: true, force: true });
        }
      },
      timeout,
    );
  });
});
