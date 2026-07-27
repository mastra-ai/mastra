import { spawn } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { execa } from 'execa';
import getPort from 'get-port';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';

const tag = inject('tag');
const registry = inject('registry');
const publishedVersions = inject('publishedVersions');
const testRoot = join(tmpdir(), `mastra-create-e2e-${process.pid}`);
const createMastraProject = join(testRoot, 'create-mastra-managed');
const mastraProject = join(testRoot, 'mastra-managed');
const emptyProject = join(testRoot, 'empty-project');
const registryEnv = {
  ...process.env,
  npm_config_registry: registry,
  pnpm_config_registry: registry,
  MASTRA_TELEMETRY_DISABLED: '1',
};
const generatedMastraPackages = [
  'mastra',
  '@mastra/core',
  '@mastra/duckdb',
  '@mastra/libsql',
  '@mastra/memory',
  '@mastra/observability',
] as const;

async function runCreate(binary: 'create-mastra' | 'mastra', projectName: string, extraArgs: string[] = []) {
  const packageSpec = `${binary}@${tag}`;
  const args = ['dlx', `--config.registry=${registry}`, packageSpec];
  if (binary === 'mastra') {
    args.push('create');
  }
  args.push(projectName, '--no-skills', '--no-git', ...extraArgs);

  await execa('pnpm', args, {
    cwd: testRoot,
    env: registryEnv,
    timeout: 5 * 60_000,
    stdio: 'inherit',
  });
}

async function readJson(path: string) {
  return JSON.parse(await readFile(path, 'utf8')) as Record<string, unknown>;
}

async function getInstalledVersions(projectPath: string) {
  const result = await execa('pnpm', ['list', '--depth', '0', '--json'], {
    cwd: projectPath,
    env: registryEnv,
  });
  const roots = JSON.parse(result.stdout) as Array<{
    dependencies?: Record<string, { version?: string }>;
    devDependencies?: Record<string, { version?: string }>;
  }>;
  const root = roots.find(candidate => {
    const dependencies = { ...candidate.dependencies, ...candidate.devDependencies };
    return generatedMastraPackages.some(packageName => packageName in dependencies);
  });
  if (!root) throw new Error(`Could not find installed Mastra dependencies in ${projectPath}`);
  const dependencies = { ...root.dependencies, ...root.devDependencies };
  return Object.fromEntries(
    generatedMastraPackages.map(packageName => [packageName, dependencies[packageName]?.version]),
  );
}

async function normalizedManagedProject(projectPath: string) {
  const manifest = await readJson(join(projectPath, 'package.json'));
  delete manifest.name;
  for (const sectionName of ['dependencies', 'devDependencies'] as const) {
    const section = manifest[sectionName] as Record<string, unknown> | undefined;
    for (const packageName of generatedMastraPackages) {
      if (section?.[packageName]) section[packageName] = '<mastra-version>';
    }
  }

  return {
    manifest,
    agent: await readFile(join(projectPath, 'src/mastra/agents/agent.ts'), 'utf8'),
    index: await readFile(join(projectPath, 'src/mastra/index.ts'), 'utf8'),
    envExample: await readFile(join(projectPath, '.env.example'), 'utf8'),
  };
}

async function waitForServer(url: string, timeout = 60_000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
    } catch {
      // The server is still starting.
    }
    await delay(500);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function waitForServerStop(url: string, timeout = 5_000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    try {
      await fetch(url, { signal: AbortSignal.timeout(500) });
    } catch {
      return;
    }
    await delay(100);
  }
  throw new Error(`Timed out waiting for ${url} to stop`);
}

describe('create-mastra published binaries', () => {
  beforeAll(async () => {
    await execa('rm', ['-rf', testRoot]);
    await execa('mkdir', ['-p', testRoot]);
    await runCreate('create-mastra', 'create-mastra-managed', ['--llm', 'openai']);
    await runCreate('mastra', 'mastra-managed', ['--llm', 'openai']);
    await runCreate('create-mastra', 'empty-project', ['--empty']);
  }, 15 * 60_000);

  afterAll(async () => {
    await execa('rm', ['-rf', testRoot]);
  });

  it('creates equivalent managed agent-harness projects through both binaries', async () => {
    expect(await normalizedManagedProject(createMastraProject)).toEqual(await normalizedManagedProject(mastraProject));

    for (const projectPath of [createMastraProject, mastraProject]) {
      expect(await getInstalledVersions(projectPath)).toEqual(publishedVersions);
      expect(await readFile(join(projectPath, 'src/mastra/agents/agent.ts'), 'utf8')).toContain("id: 'agent'");
      await expect(readFile(join(projectPath, '.env'), 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
    }
  });

  it('serves Studio and the agent API from the managed project', async () => {
    const port = await getPort();
    const server = spawn(process.execPath, [join(createMastraProject, 'node_modules/mastra/dist/index.js'), 'dev'], {
      cwd: createMastraProject,
      env: { ...registryEnv, PORT: String(port) },
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: process.platform !== 'win32',
    });
    let serverOutput = '';
    server.stdout?.on('data', (chunk: unknown) => {
      serverOutput += String(chunk);
    });
    server.stderr?.on('data', (chunk: unknown) => {
      serverOutput += String(chunk);
    });

    const serverExit = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(resolve => {
      server.once('exit', (code, signal) => resolve({ code, signal }));
    });
    const serverExited = serverExit.then(({ code, signal }) => {
      throw new Error(`Mastra dev exited before startup (code ${code}, signal ${signal})`);
    });

    try {
      const studio = await Promise.race([waitForServer(`http://localhost:${port}`), serverExited]).catch(error => {
        throw new Error(`${String(error)}\n${serverOutput}`);
      });
      expect(await studio.text()).toContain('<div id="root"></div>');

      const agentsResponse = await waitForServer(`http://localhost:${port}/api/agents`);
      const agents = (await agentsResponse.json()) as Record<string, { name?: string }>;
      expect(agents.agent?.name).toBe('Agent');
    } finally {
      if (server.exitCode === null && server.signalCode === null && server.pid) {
        if (process.platform === 'win32') {
          server.kill('SIGTERM');
        } else {
          try {
            process.kill(-server.pid, 'SIGTERM');
          } catch (error) {
            if ((error as { code?: string }).code !== 'ESRCH') {
              console.warn('Failed to terminate the Mastra dev process:', error);
            }
          }
        }
      }

      const stopped = await Promise.race([serverExit.then(() => true), delay(5_000).then(() => false)]);
      if (!stopped && server.exitCode === null && server.signalCode === null) {
        if (process.platform === 'win32') {
          server.kill('SIGKILL');
        } else if (server.pid) {
          try {
            process.kill(-server.pid, 'SIGKILL');
          } catch (error) {
            if ((error as { code?: string }).code !== 'ESRCH') {
              console.warn('Failed to kill the Mastra dev process:', error);
            }
          }
        }
        await serverExit;
      }
      await waitForServerStop(`http://localhost:${port}`);
    }
  }, 90_000);

  it('creates the exact provider-free empty scaffold', async () => {
    const entries = (await readdir(emptyProject)).sort();
    expect(entries).toEqual(
      [
        '.gitignore',
        'node_modules',
        'package.json',
        'pnpm-lock.yaml',
        'pnpm-workspace.yaml',
        'src',
        'tsconfig.json',
      ].sort(),
    );

    const manifest = await readJson(join(emptyProject, 'package.json'));
    expect(manifest).toEqual({
      name: 'empty-project',
      version: '1.0.0',
      private: true,
      type: 'module',
      engines: { node: '>=22.13.0' },
      scripts: {
        dev: 'mastra dev',
        build: 'mastra build',
        start: 'mastra start',
      },
      dependencies: { '@mastra/core': tag },
      devDependencies: {
        mastra: tag,
        typescript: '^6.0.3',
        '@types/node': 'latest',
      },
    });
    expect(await readFile(join(emptyProject, 'src/mastra/index.ts'), 'utf8')).toBe(
      "import { Mastra } from '@mastra/core/mastra';\n\nexport const mastra = new Mastra({});\n",
    );
    expect(await getInstalledVersions(emptyProject)).toMatchObject({
      mastra: publishedVersions.mastra,
      '@mastra/core': publishedVersions['@mastra/core'],
    });
    await expect(readFile(join(emptyProject, 'README.md'), 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(readFile(join(emptyProject, '.env'), 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(readdir(join(emptyProject, 'src/mastra/agents'))).rejects.toMatchObject({ code: 'ENOENT' });
  });
});
