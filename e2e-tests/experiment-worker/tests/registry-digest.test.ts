import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import { computeRegistryArtifactDigest } from '../helpers/registry-digest.js';

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })));
});

describe('registry artifact digest', () => {
  test('preserves the immutable archive digest across artifact handoff', async () => {
    const root = await mkdtemp(join(tmpdir(), 'experiment-registry-archive-digest-'));
    roots.push(root);
    const archive = join(root, 'registry-snapshot.tar');
    await writeFile(archive, 'immutable registry snapshot');

    const publishedDigest = await computeRegistryArtifactDigest(archive);
    expect(await computeRegistryArtifactDigest(archive)).toBe(publishedDigest);

    await writeFile(archive, 'mutated registry snapshot');
    expect(await computeRegistryArtifactDigest(archive)).not.toBe(publishedDigest);
  });

  test('survives handoff metadata and rejects registry mutation', async () => {
    const root = await mkdtemp(join(tmpdir(), 'experiment-registry-digest-'));
    roots.push(root);
    await mkdir(join(root, 'storage', 'package'), { recursive: true });
    await writeFile(join(root, 'verdaccio.yaml'), 'storage: ./storage\n');
    await writeFile(join(root, 'storage', 'package', 'metadata.json'), '{"version":1}\n');

    const publishedDigest = await computeRegistryArtifactDigest(root);
    await writeFile(join(root, 'handoff-digest.txt'), `${publishedDigest}\n`);
    expect(await computeRegistryArtifactDigest(root)).toBe(publishedDigest);

    await writeFile(join(root, 'storage', 'package', 'metadata.json'), '{"version":2}\n');
    expect(await computeRegistryArtifactDigest(root)).not.toBe(publishedDigest);
  });
});
