import { createHash } from 'crypto';
import { it, describe, expect, beforeAll, afterAll, inject } from 'vitest';
import { join, relative } from 'path';
import { setupMonorepo } from './prepare';
import { mkdtemp, mkdir, readdir, readFile, readlink, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import getPort from 'get-port';
import { execa, execaNode } from 'execa';

const timeout = 5 * 60 * 1000;

function getPnpmImporterDependencies(lockfile: string, importer: string): Map<string, string> {
  const lines = lockfile.split(/\r?\n/);
  const importerStart = lines.findIndex(line => line === `  ${importer}:`);
  if (importerStart === -1) {
    throw new Error(`Missing pnpm lockfile importer: ${importer}`);
  }

  const dependencies = new Map<string, string>();
  let dependencyName: string | undefined;
  for (let index = importerStart + 1; index < lines.length; index++) {
    const line = lines[index]!;
    if (/^  \S/.test(line)) break;

    const dependencyMatch = /^      ([^\s].*):$/.exec(line);
    if (dependencyMatch?.[1]) {
      dependencyName = dependencyMatch[1].replace(/^['"]|['"]$/g, '');
      continue;
    }

    const versionMatch = /^        version: (.+)$/.exec(line);
    if (dependencyName && versionMatch?.[1]) {
      dependencies.set(dependencyName, versionMatch[1].replace(/^['"]|['"]$/g, ''));
      dependencyName = undefined;
    }
  }

  return dependencies;
}

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

async function findInDir(root: string, targetName: string): Promise<boolean> {
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch {
    return false;
  }
  for (const entry of entries) {
    if (entry.name === targetName) {
      return true;
    }
    if (entry.isDirectory()) {
      if (await findInDir(join(root, entry.name), targetName)) {
        return true;
      }
    }
  }
  return false;
}

async function getDirectoryDigests(root: string): Promise<Record<string, string>> {
  const digests: Record<string, string> = {};

  async function visit(dir: string) {
    const entries = await readdir(dir, { withFileTypes: true });
    entries.sort((first, second) => first.name.localeCompare(second.name));

    for (const entry of entries) {
      const path = join(dir, entry.name);
      const relativePath = relative(root, path).replaceAll('\\', '/');
      if (entry.isDirectory()) {
        await visit(path);
      } else if (entry.isSymbolicLink()) {
        digests[relativePath] = `link:${await readlink(path)}`;
      } else if (entry.isFile()) {
        digests[relativePath] = createHash('sha256')
          .update(await readFile(path))
          .digest('hex');
      }
    }
  }

  await visit(root);
  return digests;
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

  function reserveBuildQueue() {
    const waitForTurn = buildQueue;
    let release!: () => void;
    const reservation = new Promise<void>(resolve => {
      release = resolve;
    });
    buildQueue = waitForTurn.then(() => reservation);
    return { waitForTurn, release };
  }

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

    it('should resolve scoped transitive workspace dependencies', async () => {
      const res = await fetch(`http://localhost:${port}/transitive-workspace`);
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body).toEqual({ value: 'a -> b -> c', root: 'root', app: 'App value is BEFORE.' });
    });

    it('should preserve dynamic subpath imports when the package has a nested module package.json', async () => {
      const res = await fetch(`http://localhost:${port}/protobuf-subpath`);
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body).toEqual({ typeName: 'google.protobuf.Timestamp' });
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

    it('should list a registered MCP server and execute its tool', async () => {
      const listRes = await fetch(`http://localhost:${port}/api/mcp/v0/servers`);
      const list = await listRes.json();
      expect(listRes.status).toBe(200);
      expect(list.servers.map((server: { id: string }) => server.id)).toContain('calculator');

      const toolsRes = await fetch(`http://localhost:${port}/api/mcp/calculator/tools`);
      const tools = await toolsRes.json();
      expect(toolsRes.status).toBe(200);
      expect(tools.tools.map((tool: { id: string }) => tool.id)).toEqual(['calculatorTool']);

      const execRes = await fetch(`http://localhost:${port}/api/mcp/calculator/tools/calculatorTool/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: { a: 2, b: 3 } }),
      });
      const executed = await execRes.json();
      expect(execRes.status).toBe(200);
      expect(executed).toEqual({ result: 5 });
    });

    it('should answer invalid MCP tool input with 400', async () => {
      const res = await fetch(`http://localhost:${port}/api/mcp/calculator/tools/calculatorTool/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: { a: 'two', b: 3 } }),
      });
      const body = await res.json();
      expect({ status: res.status, body }).toEqual({
        status: 400,
        body: { error: expect.stringContaining('calculatorTool') },
      });
    });
  }

  describe.sequential('dev', async () => {
    const buildReservation = reserveBuildQueue();
    let port = await getPort();
    let proc: ReturnType<typeof execa> | undefined;
    const controller = new AbortController();
    const cancelSignal = controller.signal;

    beforeAll(async () => {
      await buildReservation.waitForTurn;
      try {
        const inputFile = join(fixturePath, 'apps', 'custom');
        const mastraIndexPath = join(inputFile, 'src', 'mastra', 'index.ts');
        const mastraIndex = (await readFile(mastraIndexPath, 'utf8'))
          .replace(
            "import { testRoute } from '@/api/route/test';",
            "import { testRoute } from '@/api/route/test';\nimport { environmentRoute } from '@/api/route/environment';",
          )
          .replace(/apiRoutes: \[\s*testRoute,/, 'apiRoutes: [testRoute, environmentRoute,');
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
      } catch (error) {
        buildReservation.release();
        throw error;
      }
    }, timeout);

    afterAll(async () => {
      try {
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
      } finally {
        buildReservation.release();
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

        const readServerInstance = async () => {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 10_000);
          try {
            const instanceIdPattern = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
            while (!controller.signal.aborted) {
              const page = await fetch(`http://localhost:${port}/`, { signal: controller.signal });
              expect(page.status).toBe(200);
              const html = await page.text();
              const htmlId = html.match(/window\.MASTRA_DEV_SERVER_INSTANCE_ID = "([^"]+)";/)?.[1];
              expect(htmlId).toMatch(instanceIdPattern);
              const response = await fetch(`http://localhost:${port}/refresh-events`, { signal: controller.signal });
              expect(response.status).toBe(200);
              if (!response.body) throw new Error('Missing refresh stream');
              const reader = response.body.getReader();
              const decoder = new TextDecoder();
              let event = '';
              try {
                while (!event.includes('\n\n')) {
                  const chunk = await reader.read();
                  if (chunk.done) throw new Error('Refresh stream ended before the handshake');
                  event += decoder.decode(chunk.value, { stream: true });
                }
              } finally {
                await reader.cancel();
              }
              expect(event).toContain('data: connected');
              const id = event.match(/^id: (.+)$/m)?.[1];
              expect(id).toMatch(instanceIdPattern);
              if (htmlId === id) {
                expect(html).toContain(`window.MASTRA_DEV_SERVER_INSTANCE_ID = "${id}";`);
                return id;
              }
              // A restart between requests is valid; retry both snapshots, not just the stream.
              await new Promise(resolve => setTimeout(resolve, 100));
            }
            throw new Error('Timed out waiting for matching Studio HTML and refresh-stream generations');
          } finally {
            clearTimeout(timeout);
            controller.abort();
          }
        };

        const waitForReload = async (predicate: (body: { value: string; root: string; app: string }) => boolean) => {
          const started = Date.now();
          let lastBody: { value: string; root: string; app: string } | undefined;
          while (Date.now() - started < 60_000) {
            try {
              const res = await fetch(`http://localhost:${port}/transitive-workspace`);
              if (res.ok) {
                lastBody = (await res.json()) as { value: string; root: string; app: string };
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
          expect(baseline).toEqual({ value: 'a -> b -> c', root: 'root', app: 'App value is BEFORE.' });
          const initialInstance = await readServerInstance();
          expect(await readServerInstance()).toBe(initialInstance);

          // 2. Edit workspace package only
          await writeFile(packageSource, `export const valueC = 'c-AFTER';\n`);
          const afterPackage = await waitForReload(
            body => body.value === 'a -> b -> c-AFTER' && body.app === 'App value is BEFORE.',
          );
          expect(afterPackage).toEqual({ value: 'a -> b -> c-AFTER', root: 'root', app: 'App value is BEFORE.' });
          // A browser reconnecting after this broadcast must still detect the restart.
          await fetch(`http://localhost:${port}/__refresh`, { method: 'POST' });
          const packageInstance = await readServerInstance();
          expect(packageInstance).not.toBe(initialInstance);
          expect(await readServerInstance()).toBe(packageInstance);

          // 3. Edit app only — package AFTER must still be present (no stale optimizer cache)
          await writeFile(appRoute, originalAppRoute.replace('App value is BEFORE.', 'App value is AFTER.'));
          const afterApp = await waitForReload(
            body => body.value === 'a -> b -> c-AFTER' && body.app === 'App value is AFTER.',
          );
          expect(afterApp).toEqual({ value: 'a -> b -> c-AFTER', root: 'root', app: 'App value is AFTER.' });
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
    const sourcePinnedUnicornMagicVersion = '0.2.0';

    beforeAll(async () => {
      const packageJsonPaths = [join(fixturePath, 'package.json'), join(fixturePath, 'apps', 'custom', 'package.json')];
      const originalPackageJsons = await Promise.all(packageJsonPaths.map(path => readFile(path, 'utf-8')));
      const sourceLockfilePath = join(fixturePath, 'pnpm-lock.yaml');
      const sourceLockfile = await readFile(sourceLockfilePath, 'utf-8');
      const mastraConfigPath = join(fixturePath, 'apps', 'custom', 'src', 'mastra', 'index.ts');
      const originalMastraConfig = await readFile(mastraConfigPath, 'utf-8');

      try {
        // Keep the lockfile probe external so optimization cannot remove it from the output manifest.
        await writeFile(
          mastraConfigPath,
          originalMastraConfig.replace(
            "externals: ['bcrypt', '@inner/subpath-only']",
            "externals: ['bcrypt', '@inner/subpath-only', 'unicorn-magic']",
          ),
        );
        for (const [index, packageJsonPath] of packageJsonPaths.entries()) {
          const packageJson = JSON.parse(originalPackageJsons[index]!);
          packageJson.dependencies['unicorn-magic'] = '>=0.2.0';
          await writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));
        }

        const updatedSourceLockfile = sourceLockfile
          .replace(
            `      unicorn-magic:\n        specifier: 0.2.0\n        version: 0.2.0`,
            `      unicorn-magic:\n        specifier: '>=0.2.0'\n        version: ${sourcePinnedUnicornMagicVersion}`,
          )
          .replace(
            `      unicorn-magic:\n        specifier: 0.4.0\n        version: 0.4.0`,
            `      unicorn-magic:\n        specifier: '>=0.2.0'\n        version: ${sourcePinnedUnicornMagicVersion}`,
          );
        if (updatedSourceLockfile === sourceLockfile) {
          throw new Error('Failed to pin the source unicorn-magic resolution for lockfile reuse coverage');
        }
        await writeFile(sourceLockfilePath, updatedSourceLockfile);
        await runBuild(fixturePath);
      } finally {
        await Promise.all(packageJsonPaths.map((path, index) => writeFile(path, originalPackageJsons[index]!)));
        await writeFile(sourceLockfilePath, sourceLockfile);
        await writeFile(mastraConfigPath, originalMastraConfig);
      }

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

    it('should exclude dependencies imported only from dead NODE_ENV branches', async () => {
      const packageJsonPath = join(fixturePath, 'apps', 'custom', '.mastra', 'output', 'package.json');
      const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf-8'));

      expect(packageJson.dependencies?.['date-fns']).toBeUndefined();
    });

    it('should update the source pnpm lockfile while installing output dependencies', async () => {
      const outputDir = join(fixturePath, 'apps', 'custom', '.mastra', 'output');
      const outputFiles = await readdir(outputDir);
      expect(outputFiles).toContain('pnpm-lock.yaml');
      expect(outputFiles).not.toContain('package-lock.json');

      const packageJson = JSON.parse(await readFile(join(outputDir, 'package.json'), 'utf-8'));
      const sourceLockfile = await readFile(join(fixturePath, 'pnpm-lock.yaml'), 'utf-8');
      const outputLockfile = await readFile(join(outputDir, 'pnpm-lock.yaml'), 'utf-8');
      const sourceDependencies = getPnpmImporterDependencies(sourceLockfile, '.');
      const outputDependencies = getPnpmImporterDependencies(outputLockfile, '.');

      expect(packageJson.dependencies['unicorn-magic']).toBe('>=0.2.0');
      expect(sourceDependencies.get('unicorn-magic')).toBe(sourcePinnedUnicornMagicVersion);
      expect(outputDependencies.get('unicorn-magic')).toBe(sourcePinnedUnicornMagicVersion);
      expect([...outputDependencies.keys()]).toEqual(expect.arrayContaining(Object.keys(packageJson.dependencies)));
    });

    it('should emit a worker runtime entry with a readiness endpoint', async () => {
      const workerEntryPath = join(fixturePath, 'apps', 'custom', '.mastra', 'output', 'worker.mjs');
      const workerEntry = await readFile(workerEntryPath, 'utf-8');

      expect(workerEntry).toContain('/health');
      expect(workerEntry).toContain('startWorkers');
    });

    it(
      'should emit a versioned worker manifest when shared storage and pubsub are configured',
      async () => {
        const sourcePath = join(fixturePath, 'apps', 'custom', 'src', 'mastra', 'index.ts');
        const originalSource = await readFile(sourcePath, 'utf-8');
        const enabledSource = originalSource
          .replace(
            "import { Mastra } from '@mastra/core/mastra';",
            "import { Mastra } from '@mastra/core/mastra';\nimport { MastraWorker } from '@mastra/core/worker';",
          )
          .replace(
            'export const mastra = new Mastra({',
            `class CleanupWorker extends MastraWorker {
  readonly name = 'cleanup-jobs';
  get isRunning() { return false; }
  async start() {}
  async stop() {}
}
class MastraFactory {
  constructor(private readonly config: Record<string, unknown>) {}
  async prepare() { return this.config; }
}
const factory = new MastraFactory({ storage: {}, pubsub: {} });
const preparedArgs = await factory.prepare();
export const mastra = new Mastra({
  ...preparedArgs,
  scheduler: { tickIntervalMs: 10_000 },
  backgroundTasks: { enabled: true, globalConcurrency: 20, mode: 'worker' },
  workers: [new CleanupWorker()],`,
          );

        try {
          await writeFile(sourcePath, enabledSource);
          await runBuild(fixturePath);

          const outputPath = join(fixturePath, 'apps', 'custom', '.mastra', 'output');
          const outputFiles = await readdir(outputPath);
          expect(outputFiles).not.toContain('workers-config.mjs');
          expect(outputFiles).not.toContain('worker-manifest.mjs');

          const workersConfig = JSON.parse(await readFile(join(outputPath, 'workers.json'), 'utf-8'));
          expect(workersConfig).toEqual({
            version: 1,
            orchestration: { enabled: true },
            scheduler: { enabled: true, tickIntervalMs: 10_000 },
            backgroundTasks: { enabled: true, globalConcurrency: 20, mode: 'worker' },
            custom: ['cleanup-jobs'],
          });
        } finally {
          await writeFile(sourcePath, originalSource);
          await runBuild(fixturePath);
        }

        const workersPath = join(fixturePath, 'apps', 'custom', '.mastra', 'output', 'workers.json');
        expect(JSON.parse(await readFile(workersPath, 'utf-8'))).toBeNull();
      },
      timeout,
    );

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

    it(
      'lets an in-flight evented workflow run finish before the generated server exits on SIGTERM',
      async () => {
        // The route starts the run without awaiting it and responds at once, so
        // there is no open HTTP connection for the request drain to hold the
        // process open. Only `mastra.shutdown({ drainTimeout })` — which the
        // generated server must forward `server.drainTimeout` into — keeps
        // pubsub alive long enough for the step to finish and print its marker.
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

        let stdout = '';
        server.stdout?.on('data', (chunk: Buffer) => {
          stdout += chunk.toString();
        });

        try {
          const maxAttempts = 60;
          for (let i = 0; i < maxAttempts; i++) {
            try {
              const res = await fetch(`http://localhost:${drainPort}/api/tools`);
              if (res.ok) break;
            } catch {
              // Server not ready yet
            }
            if (i === maxAttempts - 1) {
              throw new Error('Workflow drain test server failed to start within timeout');
            }
            await new Promise(resolve => setTimeout(resolve, 1000));
          }

          const response = await fetch(`http://localhost:${drainPort}/shutdown-drain-workflow`, { method: 'POST' });
          expect(response.ok).toBe(true);
          expect(stdout).not.toContain('shutdown-drain-workflow:finished');

          server.kill('SIGTERM');

          await expect(server).resolves.toMatchObject({ exitCode: 0 });
          expect(stdout).toContain('shutdown-drain-workflow:finished');
        } finally {
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

  describe.sequential('workspace subpath externals', () => {
    it(
      'should not analyze dependencies listed in bundler externals',
      async () => {
        const isolatedFixturePath = await mkdtemp(join(tmpdir(), `mastra-monorepo-analysis-external-${pkgManager}-`));
        try {
          await setupMonorepo(isolatedFixturePath, pkgManager);

          const corePath = join(isolatedFixturePath, 'apps', 'custom', 'node_modules', '@mastra', 'core', 'dist');
          await mkdir(join(corePath, 'runtime-context'), { recursive: true });
          await writeFile(
            join(corePath, 'runtime-context', 'index.js'),
            `export { RequestContext as RuntimeContext } from '../request-context/index.js';`,
          );

          const appDir = join(isolatedFixturePath, 'apps', 'custom');
          const unsafePackageDir = join(appDir, 'node_modules', 'analysis-unsafe');
          await mkdir(unsafePackageDir, { recursive: true });
          await Promise.all([
            writeFile(
              join(unsafePackageDir, 'package.json'),
              JSON.stringify({ name: 'analysis-unsafe', version: '1.0.0', type: 'module', exports: './index.js' }),
            ),
            writeFile(join(unsafePackageDir, 'index.js'), 'export const broken = ;'),
          ]);

          const mastraConfigPath = join(appDir, 'src', 'mastra', 'index.ts');
          const mastraConfig = await readFile(mastraConfigPath, 'utf-8');
          await writeFile(
            mastraConfigPath,
            `import 'analysis-unsafe';\n${mastraConfig.replace(
              "externals: ['bcrypt', '@inner/subpath-only']",
              "externals: ['analysis-unsafe', 'bcrypt', '@inner/subpath-only']",
            )}`,
          );

          const buildResult = await execa(pkgManager, ['build'], {
            cwd: appDir,
            reject: false,
            env: { ...process.env, MASTRA_BUILD_SKIP_INSTALL: 'true' },
          });
          expect(buildResult.exitCode, `${buildResult.stdout}\n${buildResult.stderr}`).toBe(0);
        } finally {
          await rm(isolatedFixturePath, { recursive: true, force: true });
        }
      },
      timeout,
    );

    it(
      'should build a workspace subpath imported transitively when the app imports the package root',
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

          const buildResult = await execa(pkgManager, ['build'], {
            cwd: join(isolatedFixturePath, 'apps', 'custom'),
            reject: false,
            env: process.env,
          });
          expect(buildResult.exitCode).toBe(0);

          const bundledEntry = await readFile(
            join(isolatedFixturePath, 'apps', 'custom', '.mastra', 'output', 'index.mjs'),
            'utf-8',
          );
          expect(bundledEntry).not.toContain('@inner/subpath-only/value');

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
          expect(body).toEqual({ value: 'a -> b -> c', root: 'root', app: 'App value is BEFORE.' });
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

    it(
      'should reject an unresolved subpath from an externalized workspace package',
      async () => {
        const isolatedFixturePath = await mkdtemp(join(tmpdir(), `mastra-monorepo-missing-dep-test-${pkgManager}-`));
        try {
          await setupMonorepo(isolatedFixturePath, pkgManager);

          // Runtime externals skip resolution; this case must exercise bundling the missing subpath.
          const mastraConfigPath = join(isolatedFixturePath, 'apps', 'custom', 'src', 'mastra', 'index.ts');
          const mastraConfig = await readFile(mastraConfigPath, 'utf-8');
          await writeFile(
            mastraConfigPath,
            mastraConfig.replace("externals: ['bcrypt', '@inner/subpath-only']", "externals: ['bcrypt']"),
          );

          const corePath = join(isolatedFixturePath, 'apps', 'custom', 'node_modules', '@mastra', 'core', 'dist');
          await mkdir(join(corePath, 'runtime-context'), { recursive: true });
          await writeFile(
            join(corePath, 'runtime-context', 'index.js'),
            `export { RequestContext as RuntimeContext } from '../request-context/index.js';`,
          );

          const transitiveDependencyPath = join(isolatedFixturePath, 'packages', 'transitive-c', 'src', 'index.js');
          const transitiveDependencySource = await readFile(transitiveDependencyPath, 'utf-8');
          await writeFile(
            transitiveDependencyPath,
            transitiveDependencySource.replace('@inner/subpath-only/value', '@inner/subpath-only/missing'),
          );

          const buildResult = await execa(pkgManager, ['build'], {
            cwd: join(isolatedFixturePath, 'apps', 'custom'),
            reject: false,
            env: process.env,
          });
          const output = `${buildResult.stdout}\n${buildResult.stderr}`;

          expect(buildResult.exitCode, output).toBe(1);
          expect(output).toContain('Could not resolve workspace package subpath "@inner/subpath-only/missing".');
        } finally {
          await rm(isolatedFixturePath, { recursive: true, force: true });
        }
      },
      timeout,
    );
  });

  describe.sequential('Studio control route authentication', () => {
    it(
      'keeps Studio control routes public during development when server auth is configured',
      async () => {
        const isolatedFixturePath = await mkdtemp(join(tmpdir(), `mastra-monorepo-studio-auth-test-${pkgManager}-`));
        const port = await getPort();
        const controller = new AbortController();
        let proc: ReturnType<typeof execa> | undefined;

        try {
          await setupMonorepo(isolatedFixturePath, pkgManager);

          const corePath = join(isolatedFixturePath, 'apps', 'custom', 'node_modules', '@mastra', 'core', 'dist');
          await mkdir(join(corePath, 'runtime-context'), { recursive: true });
          await writeFile(
            join(corePath, 'runtime-context', 'index.js'),
            `export { RequestContext as RuntimeContext } from '../request-context/index.js';`,
          );

          const mastraConfigPath = join(isolatedFixturePath, 'apps', 'custom', 'src', 'mastra', 'index.ts');
          const originalMastraConfig = await readFile(mastraConfigPath, 'utf-8');
          const authenticatedMastraConfig = originalMastraConfig
            .replace(
              "import { ConsoleLogger } from '@mastra/core/logger';",
              "import { ConsoleLogger } from '@mastra/core/logger';\nimport { SimpleAuth } from '@mastra/core/server';",
            )
            .replace(
              'server: {',
              "server: {\n    auth: new SimpleAuth({ tokens: { 'test-token': { sub: 'test-user' } } }),",
            );
          await writeFile(mastraConfigPath, authenticatedMastraConfig);

          proc = execa('npm', ['run', 'dev'], {
            cwd: join(isolatedFixturePath, 'apps', 'custom'),
            cancelSignal: controller.signal,
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
              if (errMsg?.includes('punycode') || errMsg?.includes('falling back to an in-memory store')) {
                return;
              }
              reject(new Error('failed to start authenticated Studio dev server: ' + errMsg));
            });
            proc!.stdout?.on('data', data => {
              console.log(data?.toString());
              if (data?.toString()?.includes(`http://localhost:${port}`)) {
                resolve();
              }
            });
          });

          for (const [path, method] of [
            ['/refresh-events', 'GET'],
            ['/__refresh', 'POST'],
            ['/__hot-reload-status', 'GET'],
          ] as const) {
            const response = await fetch(`http://localhost:${port}${path}`, { method });
            expect(response.status).toBe(200);
            await response.body?.cancel();
          }
        } finally {
          if (proc) {
            try {
              proc.kill('SIGKILL');
              await Promise.race([proc.catch(() => {}), new Promise(resolve => setTimeout(resolve, 5_000))]);
            } catch (err) {
              // @ts-expect-error - killed is not typed
              if (!err.killed) {
                console.log('failed to kill authenticated Studio dev proc', err);
              }
            }
          }
          await new Promise(resolve => setTimeout(resolve, 1_000));
          await removeOutputDir(isolatedFixturePath);
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

  describe.sequential('reproducible tool bundles', () => {
    it(
      'produces identical tool bundles when invoked from the app and monorepo roots',
      async () => {
        const isolatedFixturePath = await mkdtemp(join(tmpdir(), `mastra-monorepo-reproducible-test-${pkgManager}-`));
        try {
          await setupMonorepo(isolatedFixturePath, pkgManager);

          const appDir = join(isolatedFixturePath, 'apps', 'custom');
          const outputRoot = join(appDir, '.mastra', 'output');
          const build = async (cwd: string, args: string[], cliPath?: string) => {
            await rm(join(appDir, '.mastra'), { recursive: true, force: true });
            const options = {
              cwd,
              env: { ...process.env, MASTRA_BUILD_SKIP_INSTALL: 'true' },
              reject: false,
            };
            const result = cliPath ? await execaNode(cliPath, args, options) : await execa(pkgManager, args, options);
            expect(result.exitCode, `${result.stdout}\n${result.stderr}`).toBe(0);
            const outputDigests = await getDirectoryDigests(outputRoot);
            return Object.fromEntries(
              Object.entries(outputDigests).filter(
                ([path]) => path === 'tools.mjs' || (path.startsWith('tools/') && path.endsWith('.mjs')),
              ),
            );
          };

          const first = await build(appDir, ['build']);
          const second = await build(
            isolatedFixturePath,
            ['build', '--root', 'apps/custom'],
            join(appDir, 'node_modules', 'mastra', 'dist', 'index.js'),
          );

          expect(
            Object.keys(first).filter(path => path.startsWith('tools/') && path.endsWith('.mjs')).length,
          ).toBeGreaterThan(0);
          expect(second).toEqual(first);
        } finally {
          await rm(isolatedFixturePath, { recursive: true, force: true });
        }
      },
      timeout,
    );
  });

  describe.sequential('MASTRA_BUILD_SKIP_INSTALL', () => {
    it(
      'skips dependency installation in the build output when the env var is set',
      async () => {
        const isolatedFixturePath = await mkdtemp(join(tmpdir(), `mastra-monorepo-skip-install-test-${pkgManager}-`));
        try {
          await setupMonorepo(isolatedFixturePath, pkgManager);

          const appDir = join(isolatedFixturePath, 'apps', 'custom');
          const outputRoot = join(appDir, '.mastra', 'output');

          await removeOutputDir(isolatedFixturePath);
          const skipBuild = await execa(pkgManager, ['build'], {
            cwd: appDir,
            env: { ...process.env, MASTRA_BUILD_SKIP_INSTALL: 'true' },
            reject: false,
          });
          const skipOutput = `${skipBuild.stdout}\n${skipBuild.stderr}`;

          expect(skipBuild.exitCode).toBe(0);
          expect(skipOutput).toContain('Skipping dependency installation (MASTRA_BUILD_SKIP_INSTALL set)');
          // No dependencies installed and no lockfile generated anywhere in the build output.
          expect(await findInDir(outputRoot, 'node_modules')).toBe(false);
          expect(await findInDir(outputRoot, 'package-lock.json')).toBe(false);

          await removeOutputDir(isolatedFixturePath);
          const defaultBuild = await execa(pkgManager, ['build'], {
            cwd: appDir,
            env: process.env,
            reject: false,
          });

          expect(defaultBuild.exitCode).toBe(0);
          // Default path installs dependencies into the build output.
          expect(await findInDir(outputRoot, 'node_modules')).toBe(true);
        } finally {
          await removeOutputDir(isolatedFixturePath);
        }
      },
      timeout,
    );
  });

  describe.sequential('pnpm patched dependencies', () => {
    it(
      'keeps source workspace patches applied in the built output',
      async () => {
        const isolatedFixturePath = await mkdtemp(join(tmpdir(), `mastra-monorepo-patch-test-${pkgManager}-`));
        try {
          await setupMonorepo(isolatedFixturePath, pkgManager);

          // Adding a file is version-independent, so the patch stays valid as the package moves.
          await mkdir(join(isolatedFixturePath, 'patches'), { recursive: true });
          await writeFile(
            join(isolatedFixturePath, 'patches', 'unicorn-magic.patch'),
            [
              'diff --git a/mastra-patch-marker.txt b/mastra-patch-marker.txt',
              'new file mode 100644',
              '--- /dev/null',
              '+++ b/mastra-patch-marker.txt',
              '@@ -0,0 +1 @@',
              '+patched-by-mastra-e2e',
              '',
            ].join('\n'),
          );

          const workspacePath = join(isolatedFixturePath, 'pnpm-workspace.yaml');
          const workspace = await readFile(workspacePath, 'utf8');
          await writeFile(
            workspacePath,
            `${workspace}\npatchedDependencies:\n  unicorn-magic@0.4.0: patches/unicorn-magic.patch\n`,
          );
          // The new patch entry changes the lockfile config, which CI's default frozen install rejects.
          await execa(pkgManager, ['install', '--no-frozen-lockfile', '--config.minimum-release-age=0'], {
            cwd: isolatedFixturePath,
            env: process.env,
          });

          await removeOutputDir(isolatedFixturePath);
          await execa(pkgManager, ['build'], {
            cwd: join(isolatedFixturePath, 'apps', 'custom'),
            env: process.env,
          });

          const outputDir = join(isolatedFixturePath, 'apps', 'custom', '.mastra', 'output');
          const outputWorkspace = await readFile(join(outputDir, 'pnpm-workspace.yaml'), 'utf8');

          expect(outputWorkspace).toContain('"unicorn-magic@0.4.0": "pnpm-patches/unicorn-magic.patch"');
          expect(outputWorkspace).toContain('allowUnusedPatches: true');
          expect(await readFile(join(outputDir, 'pnpm-patches', 'unicorn-magic.patch'), 'utf8')).toContain(
            'patched-by-mastra-e2e',
          );
          expect(
            await readFile(join(outputDir, 'node_modules', 'unicorn-magic', 'mastra-patch-marker.txt'), 'utf8'),
          ).toContain('patched-by-mastra-e2e');
        } finally {
          await rm(isolatedFixturePath, { recursive: true, force: true });
        }
      },
      timeout,
    );
  });

  describe.sequential('patches applied in node_modules', () => {
    it(
      'applies patches to node_modules during install from the workspace config',
      async () => {
        const fixturePath = await mkdtemp(join(tmpdir(), 'mastra-monorepo-patch-install-'));
        try {
          await setupMonorepo(fixturePath, pkgManager);

          // Add unicorn-magic as a dependency of the custom app (version matches
          // the transitive dep already resolved by setupMonorepo's pnpm install)
          const appPkgPath = join(fixturePath, 'apps', 'custom', 'package.json');
          const appPkg = JSON.parse(await readFile(appPkgPath, 'utf8'));
          appPkg.dependencies = { ...appPkg.dependencies, 'unicorn-magic': '0.2.0' };
          await writeFile(appPkgPath, JSON.stringify(appPkg, null, 2));

          // Create patch file at the monorepo root
          await mkdir(join(fixturePath, 'patches'), { recursive: true });
          await writeFile(
            join(fixturePath, 'patches', 'unicorn-magic.patch'),
            [
              'diff --git a/mastra-patch-marker.txt b/mastra-patch-marker.txt',
              'new file mode 100644',
              '--- /dev/null',
              '+++ b/mastra-patch-marker.txt',
              '@@ -0,0 +1 @@',
              '+patched-by-mastra-e2e',
              '',
            ].join('\n'),
          );

          // After setupMonorepo, setupMonorepo's pnpm install already resolved
          // unicorn-magic as a transitive dependency at 0.2.0. Use 0.2.0 in
          // both the explicit app dep and the patch specifier so they match.
          const workspacePath = join(fixturePath, 'pnpm-workspace.yaml');
          const workspace = await readFile(workspacePath, 'utf8');
          await writeFile(
            workspacePath,
            `${workspace}\npatchedDependencies:\n  unicorn-magic@0.2.0: patches/unicorn-magic.patch\n`,
          );

          // Install with patches — the patched file should appear in node_modules
          await execa(pkgManager, ['install', '--no-frozen-lockfile', '--config.minimum-release-age=0'], {
            cwd: fixturePath,
            env: process.env,
          });

          expect(
            await readFile(join(fixturePath, 'node_modules', 'unicorn-magic', 'mastra-patch-marker.txt'), 'utf8'),
          ).toContain('patched-by-mastra-e2e');
        } finally {
          await rm(fixturePath, { recursive: true, force: true });
        }
      },
      timeout,
    );
  });
});
