const { createHash } = require('node:crypto');
const { lstat, readdir, readFile, readlink } = require('node:fs/promises');
const { join, relative, sep } = require('node:path');

const excludedPaths = new Set(['handoff-digest.txt']);

async function computeRegistryArtifactDigest(registryRoot) {
  const hash = createHash('sha256');
  const rootStats = await lstat(registryRoot);
  if (rootStats.isFile()) {
    hash.update(await readFile(registryRoot));
    return hash.digest('hex');
  }

  async function visit(path) {
    const relativePath = relative(registryRoot, path).split(sep).join('/');
    if (excludedPaths.has(relativePath)) return;

    const stats = await lstat(path);
    if (stats.isDirectory()) {
      if (relativePath) hash.update(`directory\0${relativePath}\0`);
      const entries = await readdir(path);
      for (const entry of entries.sort()) await visit(join(path, entry));
      return;
    }
    if (stats.isSymbolicLink()) {
      const target = await readlink(path);
      hash.update(`symlink\0${relativePath}\0${Buffer.byteLength(target)}\0${target}\0`);
      return;
    }
    if (stats.isFile()) {
      const content = await readFile(path);
      hash.update(`file\0${relativePath}\0${content.byteLength}\0`);
      hash.update(content);
      hash.update('\0');
      return;
    }
    throw new Error(`Unsupported registry artifact entry: ${relativePath}`);
  }

  await visit(registryRoot);
  return hash.digest('hex');
}

module.exports = { computeRegistryArtifactDigest };

if (require.main === module) {
  const registryRoot = process.argv[2];
  if (!registryRoot) throw new Error('Usage: node registry-artifact-digest.cjs <registry-root>');
  computeRegistryArtifactDigest(registryRoot)
    .then(digest => process.stdout.write(`${digest}\n`))
    .catch(error => {
      console.error(error);
      process.exitCode = 1;
    });
}
