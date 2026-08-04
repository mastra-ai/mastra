import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('fs-extra/esm', () => ({
  copy: vi.fn(),
  emptyDir: vi.fn().mockResolvedValue(undefined),
  ensureDir: vi.fn().mockResolvedValue(undefined),
  default: {},
}));
vi.mock('@mastra/deployer/build', () => ({
  FileService: class {
    getFirstExistingFile() {
      return '.env';
    }
  },
}));
vi.mock('../utils.js', () => ({ shouldSkipDotenvLoading: vi.fn().mockReturnValue(false) }));

describe('ExperimentBundler', () => {
  const temporaryDirectories: string[] = [];
  const createTemporaryDirectory = async (prefix: string) => {
    const directory = await mkdtemp(join(tmpdir(), prefix));
    temporaryDirectories.push(directory);
    return directory;
  };

  afterEach(async () => {
    vi.clearAllMocks();
    await Promise.all(temporaryDirectories.splice(0).map(directory => rm(directory, { recursive: true, force: true })));
  });

  it('generates an isolated NDJSON experiment worker entry', async () => {
    const { ExperimentBundler } = await import('./ExperimentBundler');
    const bundler = new ExperimentBundler();
    const entry = (bundler as unknown as { getEntry(): string }).getEntry();

    expect((bundler as unknown as { outputDir: string }).outputDir).toBe('.');
    expect(entry).toContain("import('@mastra/core/datasets')");
    expect(entry).toContain("import('#mastra')");
    expect(entry).toContain('import { runExperimentWorker }');
    expect(entry).not.toContain('file://');
    expect(entry).toContain('await runExperimentWorker({');
    expect(entry).toContain('console.log = (...args) => console.error(...args)');
    expect(entry).toContain('console.info = (...args) => console.error(...args)');
    expect(entry).toContain('process.stdout.end(resolve)');
    expect(entry).toContain('setTimeout(resolve, 5_000)');
    expect(entry).toContain('process.exit(exitCode)');
  });

  it('resolves the runtime from the packaged CLI layout', async () => {
    const { resolveRuntimePath } = await import('./ExperimentBundler');
    const directory = await createTemporaryDirectory('mastra-experiment-package-');
    const moduleUrl = pathToFileURL(join(directory, 'dist', 'index.js')).href;

    expect(resolveRuntimePath(moduleUrl, () => false)).toBe(
      join(directory, 'dist', 'commands', 'experiment', 'runtime.js'),
    );
  });

  it('writes a machine-readable artifact manifest with file digests', async () => {
    const { ExperimentBundler } = await import('./ExperimentBundler');
    const output = await createTemporaryDirectory('mastra-experiment-worker-');
    await writeFile(join(output, 'index.mjs'), 'console.error("worker");');
    await writeFile(join(output, 'package.json'), '{"type":"module"}');

    await new ExperimentBundler().writeArtifactManifest(output, '1.2.3');

    const manifest = JSON.parse(await readFile(join(output, 'experiment-worker-manifest.json'), 'utf8'));
    expect(manifest).toMatchObject({
      artifactVersion: 1,
      kind: 'mastra-experiment-worker',
      build: { cliVersion: '1.2.3' },
      protocol: { versions: ['1'], framing: 'ndjson', datasetCanonicalizationVersion: '1' },
      launch: { arguments: ['index.mjs'], workingDirectory: '.' },
      dependencies: { manifest: 'package.json' },
    });
    expect(manifest.files).toEqual([
      { path: 'index.mjs', sha256: expect.stringMatching(/^[a-f0-9]{64}$/) },
      { path: 'package.json', sha256: expect.stringMatching(/^[a-f0-9]{64}$/) },
    ]);
    const expectedContentDigest = createHash('sha256')
      .update(manifest.files.map((file: { path: string; sha256: string }) => `${file.path}\0${file.sha256}\n`).join(''))
      .digest('hex');
    expect(manifest.artifact).toEqual({
      digestAlgorithm: 'sha256',
      contentDigest: expectedContentDigest,
      excludes: ['experiment-worker-manifest.json'],
    });
  });

  it('excludes only the root artifact manifest from digests', async () => {
    const { ExperimentBundler } = await import('./ExperimentBundler');
    const output = await createTemporaryDirectory('mastra-experiment-worker-');
    const nestedDirectory = join(output, 'nested');
    await mkdir(nestedDirectory);
    await writeFile(join(output, 'index.mjs'), '');
    await writeFile(join(output, 'package.json'), '{}');
    await writeFile(join(output, 'experiment-worker-manifest.json'), 'stale root manifest');
    await writeFile(join(nestedDirectory, 'experiment-worker-manifest.json'), 'nested artifact');

    await new ExperimentBundler().writeArtifactManifest(output, '1.2.3');

    const manifest = JSON.parse(await readFile(join(output, 'experiment-worker-manifest.json'), 'utf8'));
    expect(manifest.files.map((file: { path: string }) => file.path)).toContain(
      'nested/experiment-worker-manifest.json',
    );
    expect(
      manifest.files.filter((file: { path: string }) => file.path === 'experiment-worker-manifest.json'),
    ).toHaveLength(0);
  });

  it.each(['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lock', 'bun.lockb'])(
    'records a generated %s lockfile',
    async lockfile => {
      const { ExperimentBundler } = await import('./ExperimentBundler');
      const output = await createTemporaryDirectory('mastra-experiment-lockfile-');
      await writeFile(join(output, 'index.mjs'), '');
      await writeFile(join(output, 'package.json'), '{}');
      await writeFile(join(output, lockfile), 'lockfile');

      await new ExperimentBundler().writeArtifactManifest(output, '1.2.3');

      const manifest = JSON.parse(await readFile(join(output, 'experiment-worker-manifest.json'), 'utf8'));
      expect(manifest.dependencies.lockfile).toBe(lockfile);
    },
  );

  it('runs the protocol to completion in a fresh process', async () => {
    const { ExperimentBundler } = await import('./ExperimentBundler');
    const directory = await createTemporaryDirectory('mastra-experiment-process-');
    const coreModule = join(directory, 'core.mjs');
    const mastraModule = join(directory, 'mastra.mjs');
    const entryFile = join(directory, 'worker.mjs');
    await writeFile(
      coreModule,
      `export async function runExperiment(_mastra, config) {
        await config.onEvent({ type: 'experiment.run.started', version: 1, experimentId: config.experimentId, sequence: 1, timestamp: new Date().toISOString(), target: { type: config.targetType, id: config.targetId }, dataset: { id: 'dataset', version: 1, itemCount: config.data.length } });
        await config.onEvent({ type: 'experiment.item.completed', version: 1, experimentId: config.experimentId, sequence: 2, timestamp: new Date().toISOString(), target: { type: config.targetType, id: config.targetId }, itemId: config.data[0].id, itemIndex: 0, status: 'succeeded' });
        await config.onEvent({ type: 'experiment.run.finished', version: 1, experimentId: config.experimentId, sequence: 3, timestamp: new Date().toISOString(), target: { type: config.targetType, id: config.targetId }, outcome: 'completed', completedWithErrors: false });
      }`,
    );
    await writeFile(
      mastraModule,
      `console.log('customer import log'); export const mastra = { shutdown: async () => undefined };`,
    );
    const bundler = new ExperimentBundler();
    const entry = (bundler as unknown as { getEntry(): string })
      .getEntry()
      .replace("import('@mastra/core/datasets')", `import(${JSON.stringify(pathToFileURL(coreModule).href)})`)
      .replace("import('#mastra')", `import(${JSON.stringify(pathToFileURL(mastraModule).href)})`);
    await writeFile(entryFile, entry);

    const items = [{ id: 'item-1', input: { prompt: 'hello' }, groundTruth: 'world', toolMocks: [] }];
    const canonical = canonicalize(items);
    const digest = createHash('sha256').update(canonical).digest('hex');
    const experimentId = randomUUID();
    const request = {
      type: 'run',
      protocolVersion: '1',
      supportedProtocolVersions: ['1'],
      experimentId,
      jobId: randomUUID(),
      attempt: 1,
      idempotencyKey: randomUUID(),
      deadlineAt: new Date(Date.now() + 30_000).toISOString(),
      datasetAttestation: { itemCount: items.length, digest, canonicalizationVersion: '1' },
      packet: {
        protocolVersion: '1',
        experimentId,
        tenant: { organizationId: 'org', projectId: 'project' },
        environment: { environmentId: 'env', environmentDeployId: 'deploy' },
        artifacts: {
          buildId: bundler.buildIdentity.buildId,
          server: { id: 'server', digest: 'server-digest' },
          worker: { id: 'worker', digest: 'worker-digest' },
          gitSha: 'abcd',
          lockfileDigest: 'lock',
          mastraVersion: '1.0.0',
          nodeVersion: process.version,
        },
        target: { type: 'agent', id: 'test-agent' },
        dataset: { id: 'dataset', version: 1, itemCount: items.length, digest, canonicalizationVersion: '1', items },
        scorers: [],
        limits: { concurrency: 1, timeoutMs: 5_000 },
        policies: { allowedToolIds: [], allowedNetworkHosts: [] },
        secretReferences: [],
        requestedAt: new Date().toISOString(),
      },
    };

    const result = await runWorker(entryFile, request);
    expect(result.exitCode, result.stderr).toBe(0);
    expect(result.stderr).toContain('customer import log');
    expect(result.stdout).not.toContain('customer import log');
    expect(result.events.map(event => event.type)).toEqual(['accepted', 'run-started', 'item-completed', 'terminal']);
    expect(result.events.map(event => event.sequence)).toEqual([0, 1, 2, 3]);
    expect(result.events.at(-1)?.payload).toMatchObject({ status: 'completed' });
  });

  it('rejects a mismatched dataset attestation before loading the experiment', async () => {
    const { ExperimentBundler } = await import('./ExperimentBundler');
    const directory = await createTemporaryDirectory('mastra-experiment-protocol-');
    const coreModule = join(directory, 'core.mjs');
    const mastraModule = join(directory, 'mastra.mjs');
    const entryFile = join(directory, 'worker.mjs');
    await writeFile(coreModule, `export async function runExperiment() { throw new Error('must not run'); }`);
    await writeFile(mastraModule, `export const mastra = { shutdown: async () => undefined };`);
    const bundler = new ExperimentBundler();
    const entry = (bundler as unknown as { getEntry(): string })
      .getEntry()
      .replace("import('@mastra/core/datasets')", `import(${JSON.stringify(pathToFileURL(coreModule).href)})`)
      .replace("import('#mastra')", `import(${JSON.stringify(pathToFileURL(mastraModule).href)})`);
    await writeFile(entryFile, entry);

    const experimentId = randomUUID();
    const request = {
      type: 'run',
      protocolVersion: '1',
      supportedProtocolVersions: ['1'],
      experimentId,
      jobId: randomUUID(),
      attempt: 1,
      idempotencyKey: randomUUID(),
      deadlineAt: new Date(Date.now() + 30_000).toISOString(),
      datasetAttestation: { itemCount: 0, digest: '0'.repeat(64), canonicalizationVersion: '1' },
      packet: {
        protocolVersion: '1',
        experimentId,
        artifacts: { buildId: bundler.buildIdentity.buildId },
        target: { type: 'agent', id: 'test-agent' },
        dataset: { itemCount: 0, digest: 'f'.repeat(64), canonicalizationVersion: '1', items: [] },
        scorers: [],
        limits: { concurrency: 1, timeoutMs: 5_000 },
      },
    };

    const result = await runWorker(entryFile, request);
    expect(result.exitCode).toBe(70);
    expect(result.events).toEqual([]);
    expect(result.stderr).toContain('dataset attestation mismatch');
  });

  it('bounds shutdown by the request deadline', async () => {
    const { ExperimentBundler } = await import('./ExperimentBundler');
    const directory = await createTemporaryDirectory('mastra-experiment-shutdown-');
    const coreModule = join(directory, 'core.mjs');
    const mastraModule = join(directory, 'mastra.mjs');
    const entryFile = join(directory, 'worker.mjs');
    await writeFile(
      coreModule,
      `export async function runExperiment(_mastra, config) {
        await config.onEvent({ type: 'experiment.run.finished', version: 1, experimentId: config.experimentId, sequence: 1, timestamp: new Date().toISOString(), target: { type: config.targetType, id: config.targetId }, outcome: 'completed', completedWithErrors: false });
      }`,
    );
    await writeFile(mastraModule, `export const mastra = { shutdown: () => new Promise(() => {}) };`);
    const bundler = new ExperimentBundler();
    const entry = (bundler as unknown as { getEntry(): string })
      .getEntry()
      .replace("import('@mastra/core/datasets')", `import(${JSON.stringify(pathToFileURL(coreModule).href)})`)
      .replace("import('#mastra')", `import(${JSON.stringify(pathToFileURL(mastraModule).href)})`);
    await writeFile(entryFile, entry);

    const items: unknown[] = [];
    const digest = createHash('sha256').update(canonicalize(items)).digest('hex');
    const experimentId = randomUUID();
    const result = await runWorker(entryFile, {
      type: 'run',
      protocolVersion: '1',
      supportedProtocolVersions: ['1'],
      experimentId,
      jobId: randomUUID(),
      attempt: 1,
      idempotencyKey: randomUUID(),
      deadlineAt: new Date(Date.now() + 100).toISOString(),
      datasetAttestation: { itemCount: 0, digest, canonicalizationVersion: '1' },
      packet: {
        protocolVersion: '1',
        experimentId,
        tenant: {},
        environment: {},
        artifacts: { buildId: bundler.buildIdentity.buildId },
        target: { type: 'agent', id: 'test-agent' },
        dataset: { itemCount: 0, digest, canonicalizationVersion: '1', items },
        scorers: [],
        limits: { concurrency: 1, timeoutMs: 1_000 },
        policies: { allowedToolIds: [], allowedNetworkHosts: [] },
        secretReferences: [],
      },
    });

    expect(result.exitCode).toBe(31);
    expect(result.events.at(-1)?.payload).toMatchObject({ status: 'timed-out' });
  });
});

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map(key => `${JSON.stringify(key)}:${canonicalize(record[key])}`)
    .join(',')}}`;
}

async function runWorker(entryFile: string, request: unknown) {
  const child = spawn(process.execPath, [entryFile], { stdio: ['pipe', 'pipe', 'pipe'] });
  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8').on('data', chunk => (stdout += chunk));
  child.stderr.setEncoding('utf8').on('data', chunk => (stderr += chunk));
  child.stdin.end(`${JSON.stringify(request)}\n`);
  const exitCode = await new Promise<number | null>((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('experiment worker did not exit within 15 seconds'));
    }, 15_000);
    child.once('error', error => {
      clearTimeout(timer);
      reject(error);
    });
    child.once('exit', code => {
      clearTimeout(timer);
      resolve(code);
    });
  });
  return {
    exitCode,
    stdout,
    stderr,
    events: stdout
      .trim()
      .split('\n')
      .filter(Boolean)
      .map(line => JSON.parse(line)),
  };
}
