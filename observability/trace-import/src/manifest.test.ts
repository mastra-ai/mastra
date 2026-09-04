import { mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  assertResumeCompatible,
  initializeImportState,
  readManifest,
  resolveImportStateDirectory,
  writeManifest,
} from './manifest.js';

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map(path => rm(path, { recursive: true, force: true })));
});

async function createState() {
  const stateRoot = await mkdtemp(join(tmpdir(), 'mastra-trace-manifest-'));
  roots.push(stateRoot);
  return initializeImportState({
    stateRoot,
    projectId: 'project-1',
    sourceBaseUrl: 'https://cloud.langfuse.com',
    collectorOrigin: 'https://observability.mastra.ai',
    environment: 'production',
    snapshotAt: '2026-09-03T00:00:00.000Z',
    cutoffAt: '2026-08-04T00:00:00.000Z',
  });
}

describe('trace import manifest', () => {
  it('writes a restricted, atomically replaceable manifest without temporary leftovers', async () => {
    const { directory, manifest } = await createState();
    manifest.source.pageCount = 1;
    await writeManifest(directory, manifest);

    expect((await stat(directory)).mode & 0o777).toBe(0o700);
    expect((await stat(join(directory, 'manifest.json'))).mode & 0o777).toBe(0o600);
    expect(await readdir(directory)).toEqual(['manifest.json']);
    expect(await readManifest(directory)).toMatchObject({
      snapshotAt: '2026-09-03T00:00:00.000Z',
      cutoffAt: '2026-08-04T00:00:00.000Z',
      source: { pageCount: 1 },
    });
  });

  it.each([
    ['Langfuse base URL', { sourceBaseUrl: 'https://eu.cloud.langfuse.com' }],
    ['target project', { projectId: 'project-2' }],
    ['collector origin', { collectorOrigin: 'https://observability.eu.mastra.ai' }],
    ['target environment', { environment: 'staging' }],
  ] as const)('rejects a changed resume identity: %s', async (label, override) => {
    const { manifest } = await createState();
    expect(() =>
      assertResumeCompatible(manifest, {
        sourceBaseUrl: 'https://cloud.langfuse.com',
        projectId: 'project-1',
        collectorOrigin: 'https://observability.mastra.ai',
        environment: 'production',
        ...override,
      }),
    ).toThrow(label);
  });

  it('rejects incompatible schema, mapper, identity, and sharding versions', async () => {
    const { directory } = await createState();
    const path = join(directory, 'manifest.json');
    const original = JSON.parse(await readFile(path, 'utf8')) as Record<string, unknown>;

    await writeFile(path, JSON.stringify({ ...original, mapperVersion: 'different-mapper' }));
    await expect(readManifest(directory)).rejects.toThrow('manifest is invalid');
    await writeFile(path, JSON.stringify({ ...original, schemaVersion: 999 }));
    await expect(readManifest(directory)).rejects.toThrow('manifest is invalid');
    await writeFile(path, JSON.stringify({ ...original, idAlgorithmVersion: 'different-id-algorithm' }));
    await expect(readManifest(directory)).rejects.toThrow('manifest is invalid');
    await writeFile(path, JSON.stringify({ ...original, shardCount: 32 }));
    await expect(readManifest(directory)).rejects.toThrow('manifest is invalid');
  });

  it('loads manifests written before skipped trace samples were added', async () => {
    const { directory } = await createState();
    const path = join(directory, 'manifest.json');
    const legacy = JSON.parse(await readFile(path, 'utf8')) as Record<string, unknown>;
    delete legacy.skippedTraceSamples;
    await writeFile(path, JSON.stringify(legacy));

    await expect(readManifest(directory)).resolves.toMatchObject({
      skippedTraceSamples: [],
    });
  });

  it('rejects path traversal in project and import identifiers', () => {
    expect(() =>
      resolveImportStateDirectory({ stateRoot: '/tmp/imports', projectId: '../outside', importId: 'safe' }),
    ).toThrow('Project ID');
    expect(() =>
      resolveImportStateDirectory({ stateRoot: '/tmp/imports', projectId: 'safe', importId: '../outside' }),
    ).toThrow('Import ID');
  });

  it('rejects a batch filename that could escape the state directory', async () => {
    const { directory } = await createState();
    const path = join(directory, 'manifest.json');
    const manifest = JSON.parse(await readFile(path, 'utf8')) as Record<string, unknown>;
    manifest.batches = [
      {
        index: 0,
        file: '../../outside.json',
        spanCount: 1,
        byteLength: 1,
        sha256: 'a'.repeat(64),
        status: 'pending',
        attempts: 0,
      },
    ];
    await writeFile(path, JSON.stringify(manifest));

    await expect(readManifest(directory)).rejects.toThrow('manifest is invalid');
  });
});
