import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
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
