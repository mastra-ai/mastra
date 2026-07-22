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
      expect(body).toEqual({ value: 'a -> b -> c' });
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
          proc.kill('SIGKILL');
          await Promise.race([proc.catch(() => {}), new Promise(resolve => setTimeout(resolve, 5_000))]);
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
          expect(body).toEqual({ value: 'a -> b -> c' });
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
});
