import { createHash } from 'node:crypto';
import { lstat, readdir, readFile, readlink } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

const excludedPaths = new Set(['handoff-digest.txt']);

export async function computeRegistryArtifactDigest(registryRoot: string): Promise<string> {
  const hash = createHash('sha256');

  async function visit(path: string): Promise<void> {
    const relativePath = relative(registryRoot, path).split(sep).join('/');
    if (excludedPaths.has(relativePath)) {
      return;
    }

    const stats = await lstat(path);
    if (stats.isDirectory()) {
      if (relativePath) {
        hash.update(`directory\0${relativePath}\0`);
      }
      const entries = await readdir(path);
      for (const entry of entries.sort()) {
        await visit(join(path, entry));
      }
      return;
    }
    if (stats.isSymbolicLink()) {
      hash.update(`symlink\0${relativePath}\0${await readlink(path)}\0`);
      return;
    }
    if (stats.isFile()) {
      hash.update(`file\0${relativePath}\0`);
      hash.update(await readFile(path));
      hash.update('\0');
      return;
    }

    throw new Error(`Unsupported registry artifact entry: ${relativePath}`);
  }

  await visit(registryRoot);
  return hash.digest('hex');
}
