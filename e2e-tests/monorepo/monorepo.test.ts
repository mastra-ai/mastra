import { it, describe, expect, beforeAll, afterAll, inject } from 'vitest';
import { join, relative } from 'path';
import { setupMonorepo } from './prepare';
import { mkdtemp, mkdir, rm, readFile, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import getPort from 'get-port';
import { execa, execaNode } from 'execa';
import { glob } from 'tinyglobby';

const timeout = 5 * 60 * 1000;

const activeProcesses: Array<{ controller: AbortController; proc: ReturnType<typeof execa | typeof execaNode> }> = [];

/**
 * `npm run dev` / `npm run start` spawn the actual `mastra` process as a child, so signalling the
 * npm wrapper alone leaves that child orphaned. An orphaned `mastra dev` keeps its file watcher
 * alive and rebuilds into `.mastra/output`, which then races the next suite's `mastra build` and
 * fails it with `ENOTEMPTY: directory not empty, rmdir '.../.mastra/output'`. Kill the whole
 * process group instead, and wait for it to actually be gone before the next suite starts.
 *
 * Requires the process to have been spawned with `detached` so it leads its own group.
 */
async function killProcessTree(proc: ReturnType<typeof execa> | undefined) {
  if (!proc) {
    return;
  }

  try {
    if (process.platform !== 'win32' && proc.pid) {
      process.kill(-proc.pid, 'SIGKILL');
    } else {
      proc.kill('SIGKILL');
    }
  } catch {
    try {
      proc.kill('SIGKILL');
    } catch {}
  }

  await proc.catch(() => {});
}

async function cleanupAllProcesses() {
  for (const { controller, proc } of activeProcesses) {
    try {
      controller.abort();
      await killProcessTree(proc);
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

describe.for([['pnpm'] as const])(`%s monorepo`, ([pkgManager]) => {
  let fixturePath: string;

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
      // `recursive` is required - without it this silently fails on the populated fixture and
      // leaks a few hundred MB of node_modules into the temp dir on every run.
      await rm(fixturePath, {
        force: true,
        recursive: true,
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

    // @inner/subpath-mid imports @inner/subpath-only/greeting and @inner/subpath-only/sub/counter
    // from its own source. The app never depends on @inner/subpath-only, and that package declares
    // no "." export at all. Both the static subpath and the wildcard subpath have to survive to
    // runtime - if either leaks out of the bundle as a bare specifier this 500s with
    // ERR_MODULE_NOT_FOUND instead of failing at build time.
    it('should resolve transitive workspace subpath imports', async () => {
      const res = await fetch(`http://localhost:${port}/workspace-subpath`);
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body).toEqual({ value: 'hello from subpath-only + counted via wildcard subpath' });
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
        // Lead its own process group so afterAll can take the `mastra dev` child down with it.
        detached: process.platform !== 'win32',
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
      await killProcessTree(proc);
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
        // Lead its own process group so afterAll can take the `mastra start` child down with it.
        detached: process.platform !== 'win32',
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
      await killProcessTree(proc);
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

  /**
   * `bundler: { externals: true }` is the mode consumers are pushed into when they ship native
   * `.node` addons (realtime voice SDKs, sqlite drivers, sharp). It switches the deployer into
   * noBundling mode, where workspace packages are the only thing still compiled - which is why
   * workspace resolution bugs surface here and nowhere else. Every other suite in this file runs
   * with `externals: ['bcrypt']` or no bundler config at all, so this path is otherwise untested.
   */
  describe.sequential('build with externals: true', async () => {
    let originalConfig: string;
    let port = await getPort();
    let proc: ReturnType<typeof execaNode> | undefined;
    const controller = new AbortController();
    const cancelSignal = controller.signal;
    const mastraConfigPath = () => join(fixturePath, 'apps', 'custom', 'src', 'mastra', 'index.ts');
    const outputDir = () => join(fixturePath, 'apps', 'custom', '.mastra', 'output');

    async function readBundleFiles() {
      const files = await glob('**/*.{mjs,js}', {
        cwd: outputDir(),
        ignore: ['**/node_modules/**'],
        absolute: true,
      });
      expect(files.length).toBeGreaterThan(0);

      return Promise.all(files.map(async file => ({ file, content: await readFile(file, 'utf-8') })));
    }

    beforeAll(async () => {
      originalConfig = await readFile(mastraConfigPath(), 'utf-8');

      const modifiedConfig = originalConfig.replace(
        /bundler:\s*\{\s*externals:\s*\[[^\]]*\],?\s*\}/m,
        'bundler: {\n    externals: true,\n  }',
      );
      // Guard against the fixture drifting out from under the regex - a silent no-op replace
      // would quietly turn this suite into a duplicate of the default build suite.
      if (modifiedConfig === originalConfig || !modifiedConfig.includes('externals: true')) {
        throw new Error('failed to rewrite the fixture mastra config to `externals: true`');
      }
      await writeFile(mastraConfigPath(), modifiedConfig);

      // A workspace package with a subpath-only exports map used to crash the analyze step here
      // with `Missing "." specifier in "@inner/subpath-only" package`, so this build succeeding
      // is itself the assertion for that regression.
      await runBuild(fixturePath);

      proc = execaNode('index.mjs', {
        cwd: outputDir(),
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

          reject(new Error('failed to start with externals: true: ' + errMsg));
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
            console.log('failed to kill build with externals proc', err);
          }
        }
      }

      // Restore original config
      await writeFile(mastraConfigPath(), originalConfig);
    }, timeout);

    runApiTests(port);

    /**
     * The output has to be self-contained. Workspace packages are deliberately kept out of the
     * generated package.json, so a workspace specifier that survives into the bundle is neither
     * compiled nor installable. The build still exits 0, which is what makes this class of bug
     * silent - it only shows up as ERR_MODULE_NOT_FOUND once the output is run somewhere else.
     */
    it('should not leak workspace specifiers into the bundle', async () => {
      const bundleFiles = await readBundleFiles();

      const leaks: string[] = [];
      for (const { file, content } of bundleFiles) {
        // Bare `@inner/*` specifiers in import/export statements or dynamic imports. Anything
        // matching was left unresolved by the bundler instead of being compiled inline.
        for (const match of content.matchAll(/(?:from|import|require)\s*\(?\s*['"](@inner\/[^'"]+)['"]/g)) {
          leaks.push(`${relative(outputDir(), file)}: ${match[1]}`);
        }
      }

      expect(leaks).toEqual([]);
    });

    it('should not register workspace packages as installable dependencies', async () => {
      const packageJson = JSON.parse(await readFile(join(outputDir(), 'package.json'), 'utf-8'));
      const dependencies = Object.keys(packageJson.dependencies || {});

      expect(dependencies.filter(dep => dep.startsWith('@inner/'))).toEqual([]);
    });

    it('should inline transitive workspace subpath sources into the bundle', async () => {
      const bundleFiles = await readBundleFiles();
      const bundle = bundleFiles.map(({ content }) => content).join('\n');

      // Both the static subpath export ("./greeting") and the wildcard one ("./sub/*") have to be
      // compiled in, not merely resolvable at runtime.
      expect(bundle).toContain('hello from subpath-only');
      expect(bundle).toContain('counted via wildcard subpath');
    });
  });
});
