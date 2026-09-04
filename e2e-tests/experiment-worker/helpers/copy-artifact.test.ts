import { mkdtemp, mkdir, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { copyArtifact } from './copy-artifact.js';

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })));
});

test('rejects relative symlinks that resolve into a source root', async () => {
  const root = await mkdtemp(join(tmpdir(), 'copy-artifact-'));
  roots.push(root);
  const artifactRoot = join(root, 'artifact');
  const sourceRoot = join(root, 'source');
  const destinationRoot = join(root, 'destination');
  await Promise.all([mkdir(artifactRoot), mkdir(sourceRoot)]);
  await symlink(relative(artifactRoot, sourceRoot), join(artifactRoot, 'source-link'));

  await expect(copyArtifact({ artifactRoot, destinationRoot, sourceRoots: [sourceRoot] })).rejects.toThrow(
    'Source path found in symlink source-link',
  );
});
