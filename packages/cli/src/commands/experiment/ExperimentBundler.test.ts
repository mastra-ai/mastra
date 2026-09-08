import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readlink, rm, symlink, writeFile } from 'node:fs/promises';
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
    getExistingFiles(files: string[]) {
      return files;
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

  const writeWorkerManifest = async (directory: string, buildId: string) => {
    await writeFile(
      join(directory, 'experiment-worker-manifest.json'),
      JSON.stringify({
        build: { buildId },
        protocol: { versions: ['1'], datasetCanonicalizationVersion: '1' },
      }),
    );
  };

  afterEach(async () => {
    vi.restoreAllMocks();
    await Promise.all(temporaryDirectories.splice(0).map(directory => rm(directory, { recursive: true, force: true })));
  });

  it('layers default dotenv files from base to production override', async () => {
    const { ExperimentBundler } = await import('./ExperimentBundler');

    await expect(new ExperimentBundler().getEnvFiles()).resolves.toEqual(['.env', '.env.local', '.env.production']);
  });

  it('generates an isolated NDJSON experiment worker entry', async () => {
    const { ExperimentBundler } = await import('./ExperimentBundler');
    const bundler = new ExperimentBundler();
    const entry = (bundler as unknown as { getEntry(): string }).getEntry();

    expect((bundler as unknown as { outputDir: string }).outputDir).toBe('.');
    expect(entry).toContain("import('@mastra/core/datasets')");
    expect(entry).toContain("import('#mastra')");
    expect(entry).toContain("#mastra does not provide an export named 'mastra'");
    expect(entry).toContain('import { runExperimentWorker }');
    expect(entry).not.toContain('file://');
    expect(entry).toContain('await runExperimentWorker({');
    expect(entry).toContain('console.log = (...args) => console.error(...args)');
    expect(entry).toContain('console.info = (...args) => console.error(...args)');
    expect(entry).toContain('process.stdout.end(resolve)');
    expect(entry).toContain('setTimeout(resolve, 5_000)');
    expect(entry).toContain('process.exit(exitCode)');
    expect(entry).toContain("readFile(new URL('./experiment-worker-manifest.json', import.meta.url), 'utf8')");
    expect(entry).not.toContain(bundler.buildIdentity.buildId);
  });

  it('keeps worker bundle content stable across build identities', async () => {
    const { ExperimentBundler } = await import('./ExperimentBundler');
    const firstBundler = new ExperimentBundler();
    const secondBundler = new ExperimentBundler();

    const firstEntry = (firstBundler as unknown as { getEntry(): string }).getEntry();
    const secondEntry = (secondBundler as unknown as { getEntry(): string }).getEntry();

    expect(firstBundler.buildIdentity.buildId).not.toBe(secondBundler.buildIdentity.buildId);
    expect(firstEntry).toBe(secondEntry);
  });

  it('installs explicitly configured externals that static analysis cannot observe', async () => {
    const { Bundler } = await import('@mastra/deployer/bundler');
    vi.spyOn(Bundler.prototype as any, 'getUserBundlerOptions').mockResolvedValueOnce({
      externals: ['execa', 'existing-package'],
      dynamicPackages: ['existing-package', 'dynamic-package'],
    });
    const { ExperimentBundler } = await import('./ExperimentBundler');

    const options = await (new ExperimentBundler() as any).getUserBundlerOptions('/entry.ts', '/output');

    expect(options).toEqual({
      externals: ['execa', 'existing-package'],
      dynamicPackages: ['existing-package', 'dynamic-package', 'execa'],
    });
  });

  it('does not treat externals true as an explicit runtime dependency list', async () => {
    const { Bundler } = await import('@mastra/deployer/bundler');
    vi.spyOn(Bundler.prototype as any, 'getUserBundlerOptions').mockResolvedValueOnce({
      externals: true,
      dynamicPackages: ['dynamic-package'],
    });
    const { ExperimentBundler } = await import('./ExperimentBundler');

    const options = await (new ExperimentBundler() as any).getUserBundlerOptions('/entry.ts', '/output');

    expect(options).toEqual({ externals: true, dynamicPackages: ['dynamic-package'] });
  });

  it('removes pnpm install metadata that embeds build-machine paths', async () => {
    const { removePnpmInstallMetadata } = await import('./ExperimentBundler');
    const output = await createTemporaryDirectory('mastra-experiment-worker-');
    const nodeModules = join(output, 'node_modules');
    const packageRoot = join(nodeModules, 'dependency');
    await mkdir(join(nodeModules, '.bin'), { recursive: true });
    await mkdir(join(nodeModules, '.pnpm'), { recursive: true });
    await mkdir(join(packageRoot, 'node_modules', '.bin'), { recursive: true });
    await mkdir(packageRoot, { recursive: true });
    await writeFile(join(packageRoot, 'cli.js'), 'export default true;');
    await symlink(join(packageRoot, 'cli.js'), join(nodeModules, '.bin', 'dependency'));
    await symlink(join(packageRoot, 'cli.js'), join(packageRoot, 'node_modules', '.bin', 'dependency'));
    await writeFile(join(nodeModules, '.modules.yaml'), `virtualStoreDir: ${output}/node_modules/.pnpm\n`);
    await writeFile(join(nodeModules, '.pnpm-workspace-state-v1.json'), JSON.stringify({ root: output }));
    await writeFile(join(output, 'preflight-local-paths.json'), '[]');
    await writeFile(join(output, 'preflight-metadata.json'), '{"version":1,"localPaths":[],"userEnvRefs":[]}');
    await writeFile(join(packageRoot, 'index.js'), 'export default true;');

    await removePnpmInstallMetadata(output);

    for (const name of ['.pnpm', '.modules.yaml', '.pnpm-workspace-state-v1.json']) {
      await expect(readFile(join(nodeModules, name), 'utf8')).rejects.toMatchObject({
        code: expect.stringMatching(/EISDIR|ENOENT/),
      });
    }
    await expect(readlink(join(nodeModules, '.bin', 'dependency'))).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(readlink(join(packageRoot, 'node_modules', '.bin', 'dependency'))).rejects.toMatchObject({
      code: 'ENOENT',
    });
    for (const name of ['preflight-local-paths.json', 'preflight-metadata.json']) {
      await expect(readFile(join(output, name), 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
    }
    await expect(readFile(join(packageRoot, 'index.js'), 'utf8')).resolves.toBe('export default true;');
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
    await mkdir(join(output, '.build'), { recursive: true });
    await writeFile(join(output, '.build', 'module-resolve-map.json'), JSON.stringify({ entry: output }));
    await writeFile(join(output, 'index.mjs'), 'console.error("worker");');
    await writeFile(join(output, 'package.json'), '{"type":"module"}');

    await new ExperimentBundler().writeArtifactManifest(output, '1.2.3');

    await expect(readFile(join(output, '.build', 'module-resolve-map.json'), 'utf8')).rejects.toMatchObject({
      code: 'ENOENT',
    });
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
      excludes: ['experiment-worker-manifest.json', 'node_modules'],
    });
  });

  it('evaluates Mastra configuration in a scratch directory and reports output-directory side effects', async () => {
    const originalWorkingDirectory = process.cwd();
    const output = await createTemporaryDirectory('mastra-experiment-worker-');
    const { Bundler } = await import('@mastra/deployer/bundler');
    vi.spyOn(Bundler.prototype as any, 'getUserBundlerOptions').mockImplementationOnce(async () => {
      expect(process.cwd()).not.toBe(originalWorkingDirectory);
      await mkdir(join(output, 'runtime-state'));
      await writeFile(join(output, 'mastra.db'), 'local state');
      await writeFile(join(output, 'runtime-state', 'vector.data'), 'local state');
      return { externals: [] };
    });
    const { ExperimentBundler } = await import('./ExperimentBundler');

    await expect((new ExperimentBundler() as any).getUserBundlerOptions('/entry.ts', output)).rejects.toThrow(
      'Mastra configuration initialization created or modified unexpected files in the experiment worker artifact: mastra.db, runtime-state/vector.data',
    );
    expect(process.cwd()).toBe(originalWorkingDirectory);
    await expect(readFile(join(output, 'mastra.db'), 'utf8')).resolves.toBe('local state');
    await expect(readFile(join(output, 'runtime-state', 'vector.data'), 'utf8')).resolves.toBe('local state');
  });

  it('reports files modified during Mastra configuration initialization', async () => {
    const output = await createTemporaryDirectory('mastra-experiment-worker-');
    await writeFile(join(output, 'package.json'), '{"type":"module"}');
    const { Bundler } = await import('@mastra/deployer/bundler');
    vi.spyOn(Bundler.prototype as any, 'getUserBundlerOptions').mockImplementationOnce(async () => {
      await writeFile(join(output, 'package.json'), '{}');
      return { externals: [] };
    });
    const { ExperimentBundler } = await import('./ExperimentBundler');

    await expect((new ExperimentBundler() as any).getUserBundlerOptions('/entry.ts', output)).rejects.toThrow(
      'Mastra configuration initialization created or modified unexpected files in the experiment worker artifact: package.json',
    );
  });

  it('reports files deleted during Mastra configuration initialization', async () => {
    const output = await createTemporaryDirectory('mastra-experiment-worker-');
    await writeFile(join(output, 'package.json'), '{"type":"module"}');
    const { Bundler } = await import('@mastra/deployer/bundler');
    vi.spyOn(Bundler.prototype as any, 'getUserBundlerOptions').mockImplementationOnce(async () => {
      await rm(join(output, 'package.json'));
      return { externals: [] };
    });
    const { ExperimentBundler } = await import('./ExperimentBundler');

    await expect((new ExperimentBundler() as any).getUserBundlerOptions('/entry.ts', output)).rejects.toThrow(
      'Mastra configuration initialization created or modified unexpected files in the experiment worker artifact: package.json',
    );
  });

  it('restores the working directory when Mastra configuration initialization fails', async () => {
    const originalWorkingDirectory = process.cwd();
    const output = await createTemporaryDirectory('mastra-experiment-worker-');
    const { Bundler } = await import('@mastra/deployer/bundler');
    vi.spyOn(Bundler.prototype as any, 'getUserBundlerOptions').mockRejectedValueOnce(
      new Error('configuration failed'),
    );
    const { ExperimentBundler } = await import('./ExperimentBundler');

    await expect((new ExperimentBundler() as any).getUserBundlerOptions('/entry.ts', output)).rejects.toThrow(
      'configuration failed',
    );
    expect(process.cwd()).toBe(originalWorkingDirectory);
  });

  it('preserves database assets included in the artifact', async () => {
    const { ExperimentBundler } = await import('./ExperimentBundler');
    const output = await createTemporaryDirectory('mastra-experiment-worker-');
    const nestedDirectory = join(output, 'runtime-state');
    await mkdir(nestedDirectory);
    await writeFile(join(output, 'index.mjs'), '');
    await writeFile(join(output, 'package.json'), '{}');
    const databaseAssets = ['seed.db', 'runtime-state/seed.sqlite'];
    await Promise.all(databaseAssets.map(path => writeFile(join(output, path), 'seed data')));

    await new ExperimentBundler().writeArtifactManifest(output, '1.2.3');

    const manifest = JSON.parse(await readFile(join(output, 'experiment-worker-manifest.json'), 'utf8'));
    expect(manifest.files.map((file: { path: string }) => file.path)).toEqual([
      'index.mjs',
      'package.json',
      'runtime-state/seed.sqlite',
      'seed.db',
    ]);
    await Promise.all(
      databaseAssets.map(path => expect(readFile(join(output, path), 'utf8')).resolves.toBe('seed data')),
    );
  });

  it('excludes node_modules from file digests and content digest', async () => {
    const { ExperimentBundler } = await import('./ExperimentBundler');
    const output = await createTemporaryDirectory('mastra-experiment-worker-');
    const packageStore = await createTemporaryDirectory('mastra-experiment-package-store-');
    await mkdir(join(output, 'node_modules'));
    await writeFile(join(output, 'index.mjs'), '');
    await writeFile(join(output, 'package.json'), '{}');
    await writeFile(join(packageStore, 'package.json'), '{"name":"linked-package"}');
    await symlink(packageStore, join(output, 'node_modules', 'linked-package'));

    const bundler = new ExperimentBundler();
    await bundler.writeArtifactManifest(output, '1.2.3');
    const firstManifest = JSON.parse(await readFile(join(output, 'experiment-worker-manifest.json'), 'utf8'));

    await writeFile(join(packageStore, 'package.json'), '{"name":"changed-linked-package"}');
    await writeFile(join(output, 'node_modules', 'installed-package.json'), '{"changed":true}');
    await bundler.writeArtifactManifest(output, '1.2.3');
    const secondManifest = JSON.parse(await readFile(join(output, 'experiment-worker-manifest.json'), 'utf8'));

    expect(firstManifest.files).toEqual([
      { path: 'index.mjs', sha256: expect.stringMatching(/^[a-f0-9]{64}$/) },
      { path: 'package.json', sha256: expect.stringMatching(/^[a-f0-9]{64}$/) },
    ]);
    expect(secondManifest.files).toEqual(firstManifest.files);
    expect(secondManifest.artifact.contentDigest).toBe(firstManifest.artifact.contentDigest);
  });

  it('hashes relative symlink targets outside excluded directories without traversing them', async () => {
    const { ExperimentBundler } = await import('./ExperimentBundler');
    const output = await createTemporaryDirectory('mastra-experiment-worker-');
    const linkedDirectory = join(output, 'linked-directory-target');
    await mkdir(linkedDirectory);
    await writeFile(join(output, 'index.mjs'), '');
    await writeFile(join(output, 'package.json'), '{}');
    await writeFile(join(linkedDirectory, 'nested.txt'), 'not traversed');
    await symlink('linked-directory-target', join(output, 'linked-directory'));

    await new ExperimentBundler().writeArtifactManifest(output, '1.2.3');

    const manifest = JSON.parse(await readFile(join(output, 'experiment-worker-manifest.json'), 'utf8'));
    expect(manifest.files).toContainEqual({
      path: 'linked-directory',
      type: 'symlink',
      target: 'linked-directory-target',
      sha256: createHash('sha256').update('linked-directory-target').digest('hex'),
    });
    expect(manifest.files).toContainEqual(expect.objectContaining({ path: 'linked-directory-target/nested.txt' }));
  });

  it('rejects absolute symlink targets in relocatable artifacts', async () => {
    const { ExperimentBundler } = await import('./ExperimentBundler');
    const output = await createTemporaryDirectory('mastra-experiment-worker-');
    const linkedDirectory = await createTemporaryDirectory('mastra-experiment-linked-directory-');
    await writeFile(join(output, 'index.mjs'), '');
    await writeFile(join(output, 'package.json'), '{}');
    await symlink(linkedDirectory, join(output, 'linked-directory'));

    await expect(new ExperimentBundler().writeArtifactManifest(output, '1.2.3')).rejects.toThrow(
      'Experiment worker artifacts cannot contain absolute symlinks: linked-directory',
    );
  });

  it('rejects relative symlink targets that escape relocatable artifacts', async () => {
    const { ExperimentBundler } = await import('./ExperimentBundler');
    const output = await createTemporaryDirectory('mastra-experiment-worker-');
    const publicDirectory = join(output, 'public');
    await mkdir(publicDirectory);
    await writeFile(join(output, 'index.mjs'), '');
    await writeFile(join(output, 'package.json'), '{}');
    await symlink('../../outside', join(publicDirectory, 'link'));

    await expect(new ExperimentBundler().writeArtifactManifest(output, '1.2.3')).rejects.toThrow(
      'Experiment worker artifacts cannot contain escaping symlinks: public/link',
    );
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
    await writeWorkerManifest(directory, bundler.buildIdentity.buildId);

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
    await writeWorkerManifest(directory, bundler.buildIdentity.buildId);

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
    await writeWorkerManifest(directory, bundler.buildIdentity.buildId);

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
