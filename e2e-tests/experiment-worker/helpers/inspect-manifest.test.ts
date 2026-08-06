import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { inspectManifest } from '../helpers/inspect-manifest.js';

const roots: string[] = [];
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })));
});

test('validates manifest ordering with the producer bytewise comparator', async () => {
  const root = await mkdtemp(join(tmpdir(), 'experiment-manifest-'));
  roots.push(root);
  await writeFile(join(root, 'Z.txt'), 'uppercase');
  await writeFile(join(root, 'a.txt'), 'lowercase');
  const files = [
    { path: 'Z.txt', sha256: sha256('uppercase') },
    { path: 'a.txt', sha256: sha256('lowercase') },
  ];
  await writeFile(
    join(root, 'experiment-worker-manifest.json'),
    JSON.stringify({
      artifactVersion: 1,
      kind: 'mastra-experiment-worker',
      build: { buildId: 'build', cliVersion: '1.0.0', createdAt: new Date(0).toISOString() },
      protocol: { versions: ['1'], framing: 'ndjson', datasetCanonicalizationVersion: '1' },
      launch: { executable: 'node', arguments: ['index.mjs'], workingDirectory: '.' },
      dependencies: { manifest: 'package.json' },
      artifact: {
        digestAlgorithm: 'sha256',
        contentDigest: sha256(files.map(file => `${file.path}\0${file.sha256}\n`).join('')),
        excludes: ['experiment-worker-manifest.json', 'node_modules'],
      },
      files,
    }),
  );

  await expect(inspectManifest(root)).resolves.toEqual(
    expect.objectContaining({ manifest: expect.objectContaining({ files }) }),
  );
});

test.each(['../outside.txt', '/tmp/outside.txt'])(
  'rejects manifest paths outside the artifact root: %s',
  async path => {
    const root = await mkdtemp(join(tmpdir(), 'experiment-manifest-'));
    roots.push(root);
    const files = [{ path, sha256: sha256('outside') }];
    await writeFile(
      join(root, 'experiment-worker-manifest.json'),
      JSON.stringify({
        artifactVersion: 1,
        kind: 'mastra-experiment-worker',
        build: { buildId: 'build', cliVersion: '1.0.0', createdAt: new Date(0).toISOString() },
        protocol: { versions: ['1'], framing: 'ndjson', datasetCanonicalizationVersion: '1' },
        launch: { executable: 'node', arguments: ['index.mjs'], workingDirectory: '.' },
        dependencies: { manifest: 'package.json' },
        artifact: {
          digestAlgorithm: 'sha256',
          contentDigest: sha256(files.map(file => `${file.path}\0${file.sha256}\n`).join('')),
          excludes: ['experiment-worker-manifest.json', 'node_modules'],
        },
        files,
      }),
    );

    await expect(inspectManifest(root)).rejects.toThrow(`Manifest path escapes artifact root: ${path}`);
  },
);
