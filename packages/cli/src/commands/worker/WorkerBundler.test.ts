import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('fs-extra/esm', () => ({
  copy: vi.fn(),
  emptyDir: vi.fn().mockResolvedValue(undefined),
  ensureDir: vi.fn().mockResolvedValue(undefined),
  default: {},
}));

vi.mock('fs-extra', () => ({
  copy: vi.fn(),
}));

vi.mock('@mastra/deployer/build', () => {
  class MockFileService {
    getFirstExistingFile = vi.fn().mockReturnValue('.env');
    getExistingFiles = vi.fn((files: string[]) => files);
  }

  return {
    FileService: MockFileService,
  };
});

vi.mock('../utils.js', () => ({
  shouldSkipDotenvLoading: vi.fn().mockReturnValue(false),
}));

async function getAvailablePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Could not reserve a port for the worker health test');
  }
  await new Promise<void>((resolve, reject) => server.close(error => (error ? reject(error) : resolve())));
  return address.port;
}

async function waitForHealthStatus(port: number, expectedStatus: number): Promise<void> {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`);
      if (response.status === expectedStatus) return;
    } catch {}
    await delay(25);
  }
  throw new Error(`Worker health endpoint did not return ${expectedStatus}`);
}

describe('WorkerBundler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  describe('getEntry', () => {
    it('emits a role-agnostic worker entry that calls startWorkers() with no arg', async () => {
      const { WorkerBundler } = await import('./WorkerBundler');
      const bundler = new WorkerBundler();

      const entry = (bundler as any).getEntry();

      expect(entry).toContain("import { mastra } from '#mastra'");
      expect(entry).toContain("import { createServer } from 'node:http'");
      expect(entry).toContain("request.url !== '/health'");
      expect(entry).toContain('response.statusCode = workersReady ? 200 : 503');
      expect(entry).toContain("process.env.PORT ?? '4111'");
      expect(entry).toContain('await mastra.startWorkers()');
      expect(entry).toContain('workersReady = true');
      expect(entry).toContain('await mastra.stopWorkers()');
      expect(entry).toContain("process.on('SIGINT'");
      expect(entry).toContain("process.on('SIGTERM'");
    });

    it('does not interpolate a worker name into the entry source', async () => {
      const { WorkerBundler } = await import('./WorkerBundler');
      const bundler = new WorkerBundler();

      const entry = (bundler as any).getEntry();

      // role is determined at runtime via MASTRA_WORKERS, not baked into the bundle
      expect(entry).not.toMatch(/startWorkers\(['"`]/);
    });
  });

  it('lets app env override inherited process variables', async () => {
    const { createWorkerManifestEnvironment } = await import('./WorkerBundler');
    vi.stubEnv('NODE_ENV', 'development');

    expect(createWorkerManifestEnvironment({ NODE_ENV: 'production' }, { inheritProcessEnv: true }).NODE_ENV).toBe(
      'production',
    );
  });

  it('does not expose unrelated host secrets by default', async () => {
    const { createWorkerManifestEnvironment } = await import('./WorkerBundler');
    vi.stubEnv('CI_SECRET_TOKEN', 'host-secret');

    expect(createWorkerManifestEnvironment({ NODE_ENV: 'production' })).not.toHaveProperty('CI_SECRET_TOKEN');
  });

  it('introspects workers in an isolated cwd and lets the parent update the manifest from stdout', async () => {
    const { createWorkerManifestEnvironment, getWorkerManifestEntry, introspectWorkerManifest, WORKER_MANIFEST_ENTRY } =
      await import('./WorkerBundler');
    const tempDir = await mkdtemp(join(tmpdir(), 'mastra-worker-manifest-'));
    const captureDir = await mkdtemp(join(tmpdir(), 'mastra-worker-cwd-capture-'));
    const capturePath = join(captureDir, 'cwd.txt');
    const manifestPath = join(tempDir, 'workers.json');
    const entryPath = join(tempDir, `${WORKER_MANIFEST_ENTRY}.mjs`);

    try {
      vi.stubEnv('MASTRA_WORKERS', 'false');
      vi.stubEnv('DEPLOYMENT_WORKERS', 'local-only');
      await writeFile(
        manifestPath,
        JSON.stringify({
          version: 1,
          orchestration: { enabled: true },
          scheduler: { enabled: true },
          backgroundTasks: { enabled: false },
          custom: [],
        }),
      );
      await writeFile(
        join(tempDir, 'workers-config.mjs'),
        `import { writeFile } from 'node:fs/promises';
        await writeFile(process.env.INTROSPECTION_CWD_CAPTURE, process.cwd());
        await writeFile('relative-side-effect.txt', 'must not touch the build artifact');
        console.log('worker config startup output');
        export const workers = process.env.MASTRA_WORKERS === 'false' ? false : [
          { name: 'orchestration' },
          ...process.env.DEPLOYMENT_WORKERS.split(',').map(name => ({ name })),
          { name: 'backgroundTasks' },
        ];`,
      );
      await writeFile(join(tempDir, 'mastra.mjs'), `throw new Error('full Mastra application must not be imported');`);
      const workerManifestEntry = getWorkerManifestEntry();
      expect(workerManifestEntry).toContain("from './workers-config.mjs'");
      expect(workerManifestEntry).not.toContain("from '#mastra'");
      expect(workerManifestEntry).not.toContain('workers.json');
      expect(workerManifestEntry).toContain('process.stdout.write');
      await writeFile(entryPath, workerManifestEntry);

      const deploymentEnv = createWorkerManifestEnvironment({
        DEPLOYMENT_WORKERS: 'github-events,cleanup-jobs,cleanup-jobs',
        INTROSPECTION_CWD_CAPTURE: capturePath,
      });
      await introspectWorkerManifest(tempDir, deploymentEnv);

      const manifest = JSON.parse(await readFile(manifestPath, 'utf-8'));
      expect(manifest.custom).toEqual(['cleanup-jobs', 'github-events']);
      const introspectionCwd = await readFile(capturePath, 'utf-8');
      expect(introspectionCwd).not.toBe(tempDir);
      expect(introspectionCwd).toContain('mastra-worker-introspection-');
      await expect(access(join(tempDir, 'relative-side-effect.txt'))).rejects.toThrow();
      await expect(access(entryPath)).resolves.toBeUndefined();
    } finally {
      await rm(tempDir, { recursive: true, force: true });
      await rm(captureDir, { recursive: true, force: true });
    }
  });

  it('surfaces subprocess output and leaves the manifest unchanged when introspection fails', async () => {
    const { getWorkerManifestEntry, introspectWorkerManifest, WORKER_MANIFEST_ENTRY } = await import('./WorkerBundler');
    const tempDir = await mkdtemp(join(tmpdir(), 'mastra-worker-manifest-failure-'));
    const manifestPath = join(tempDir, 'workers.json');
    const originalManifest = JSON.stringify({
      version: 1,
      orchestration: { enabled: false },
      scheduler: { enabled: false },
      backgroundTasks: { enabled: false },
      custom: [],
    });

    try {
      await writeFile(manifestPath, originalManifest);
      await writeFile(
        join(tempDir, 'workers-config.mjs'),
        `console.log('startup stdout detail');
        console.error('startup stderr detail');
        throw new Error('worker initialization exploded');
        export const workers = [];`,
      );
      await writeFile(join(tempDir, `${WORKER_MANIFEST_ENTRY}.mjs`), getWorkerManifestEntry());

      await expect(introspectWorkerManifest(tempDir, {})).rejects.toThrow(
        /startup stdout detail[\s\S]*startup stderr detail/,
      );
      await expect(readFile(manifestPath, 'utf-8')).resolves.toBe(originalManifest);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('terminates introspection after the configured timeout and leaves the manifest unchanged', async () => {
    const { getWorkerManifestEntry, introspectWorkerManifest, WORKER_MANIFEST_ENTRY } = await import('./WorkerBundler');
    const tempDir = await mkdtemp(join(tmpdir(), 'mastra-worker-manifest-timeout-'));
    const manifestPath = join(tempDir, 'workers.json');
    const originalManifest = JSON.stringify({
      version: 1,
      orchestration: { enabled: false },
      scheduler: { enabled: false },
      backgroundTasks: { enabled: false },
      custom: [],
    });

    try {
      await writeFile(manifestPath, originalManifest);
      await writeFile(
        join(tempDir, 'workers-config.mjs'),
        `await new Promise(resolve => setTimeout(resolve, 60_000));
        export const workers = [];`,
      );
      await writeFile(join(tempDir, `${WORKER_MANIFEST_ENTRY}.mjs`), getWorkerManifestEntry());

      await expect(introspectWorkerManifest(tempDir, {}, { timeoutMs: 50 })).rejects.toThrow(
        'Worker manifest introspection timed out after 50ms',
      );
      await expect(readFile(manifestPath, 'utf-8')).resolves.toBe(originalManifest);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('reports starting until workers are ready, then reports healthy', async () => {
    const { getWorkerEntry } = await import('./WorkerBundler');
    const tempDir = await mkdtemp(join(tmpdir(), 'mastra-worker-health-'));
    const port = await getAvailablePort();
    const workerEntry = getWorkerEntry().replace("from '#mastra'", "from './mastra.mjs'");
    await writeFile(
      join(tempDir, 'mastra.mjs'),
      `export const mastra = {
        async startWorkers() { await new Promise(resolve => process.stdin.once('data', resolve)); },
        async stopWorkers() {},
      };`,
    );
    await writeFile(join(tempDir, 'worker.mjs'), workerEntry);

    const child = spawn(process.execPath, ['worker.mjs'], {
      cwd: tempDir,
      env: { ...process.env, PORT: String(port) },
      stdio: ['pipe', 'ignore', 'pipe'],
    });
    const childExit = once(child, 'exit');
    let stderr = '';
    child.stderr.setEncoding('utf-8');
    child.stderr.on('data', chunk => {
      stderr += chunk;
    });

    try {
      await waitForHealthStatus(port, 503);
      child.stdin.write('ready');
      await waitForHealthStatus(port, 200);
    } finally {
      child.kill('SIGTERM');
      await childExit;
      await rm(tempDir, { recursive: true, force: true });
    }

    expect(stderr).toBe('');
  });

  it('layers default dotenv files from base to production override', async () => {
    const { WorkerBundler } = await import('./WorkerBundler');

    await expect(new WorkerBundler().getEnvFiles()).resolves.toEqual(['.env', '.env.local', '.env.production']);
  });

  describe('output directory', () => {
    it('defaults to the same "output" folder as the server build (overwriting is the default)', async () => {
      const { WorkerBundler } = await import('./WorkerBundler');
      const bundler = new WorkerBundler();

      expect((bundler as unknown as { outputDir: string }).outputDir).toBe('output');
    });

    it('honors a user-supplied outputDir leaf', async () => {
      const { WorkerBundler } = await import('./WorkerBundler');
      const bundler = new WorkerBundler({ outputDir: '.' });

      expect((bundler as unknown as { outputDir: string }).outputDir).toBe('.');
    });
  });
});
