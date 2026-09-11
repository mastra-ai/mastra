import { mkdtemp, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  assertTraceImportResumeCompatible,
  initializeTraceImport,
  readTraceImportManifest,
  resolveTraceImportDirectory,
  writeTraceImportManifest,
} from './manifest.js';

const temporaryDirectories: string[] = [];
const source = {
  provider: 'test-provider',
  baseUrl: 'https://source.example',
  projectId: 'source-project',
  idAlgorithmVersion: '1',
};
const window = {
  cutoffAt: '2026-08-12T12:00:00.000Z',
  snapshotAt: '2026-09-11T12:00:00.000Z',
};

async function initialize() {
  const stateRoot = await mkdtemp(join(tmpdir(), 'trace-import-manifest-'));
  temporaryDirectories.push(stateRoot);
  return initializeTraceImport({ stateRoot, source, targetProjectId: 'target-project', window });
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map(path => rm(path, { recursive: true, force: true })));
});

describe('trace import manifest', () => {
  it('creates private state and atomically updates its checkpoint', async () => {
    const { directory, manifest } = await initialize();
    const updated = await writeTraceImportManifest(directory, { ...manifest, phase: 'prepared' });

    expect((await readTraceImportManifest(directory)).phase).toBe('prepared');
    expect(updated.updatedAt).not.toBe('');
    expect(await readdir(directory)).toEqual(['manifest.json']);
    expect((await stat(directory)).mode & 0o777).toBe(0o700);
    expect((await stat(join(directory, 'manifest.json'))).mode & 0o777).toBe(0o600);
  });

  it('allows only safe project and import IDs in state paths', () => {
    expect(() =>
      resolveTraceImportDirectory({ stateRoot: '/tmp/imports', targetProjectId: '../escape', importId: 'safe' }),
    ).toThrow('Target project ID');
    expect(() =>
      resolveTraceImportDirectory({ stateRoot: '/tmp/imports', targetProjectId: 'safe', importId: '../escape' }),
    ).toThrow('Import ID');
  });

  it('protects the source, target, and ID identity of prepared data', async () => {
    const { manifest } = await initialize();
    for (const changedSource of [
      { ...source, provider: 'another-provider' },
      { ...source, baseUrl: 'https://another-source.example' },
      { ...source, projectId: 'another-project' },
      { ...source, idAlgorithmVersion: '2' },
    ]) {
      expect(() =>
        assertTraceImportResumeCompatible(manifest, {
          source: changedSource,
          targetProjectId: 'target-project',
        }),
      ).toThrow('source');
    }
    expect(() => assertTraceImportResumeCompatible(manifest, { source, targetProjectId: 'another-target' })).toThrow(
      'target',
    );
  });

  it('rejects invalid or incompatible persisted state without deleting it', async () => {
    const { directory } = await initialize();
    await writeFile(join(directory, 'manifest.json'), '{"schemaVersion":0}\n');

    await expect(readTraceImportManifest(directory)).rejects.toThrow('valid trace import manifest');
    expect(await readdir(directory)).toEqual(['manifest.json']);
  });
});
