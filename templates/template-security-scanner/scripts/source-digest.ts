import { createHash } from 'node:crypto';
import { lstat, readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

/** Hash the selected source tree while excluding generated output and local runtime state. */
export async function sourceDigest(root: string) {
  const files = [
    'package.json',
    'tsconfig.json',
    'vitest.config.ts',
    'README.md',
    'CONTRIBUTING.md',
    '.env.example',
    '.gitignore',
    '.nvmrc',
    '.oxfmtrc.json',
  ];
  for (const directory of ['src', 'scripts', 'tests', 'docker', 'web', 'references', 'docs', 'example-target-api']) {
    for (const entry of await readdir(join(root, directory), { recursive: true })) {
      const path = `${directory}/${entry}`,
        stat = await lstat(join(root, path));
      if (stat.isSymbolicLink()) throw new Error('SOURCE_SYMLINK_UNSUPPORTED');
      if (stat.isFile() && !path.includes('/__pycache__/') && !path.startsWith('web/dist/')) files.push(path);
    }
  }
  const hash = createHash('sha256');
  for (const path of files.sort()) {
    const bytes = await readFile(join(root, path));
    hash.update(`${path}\0${bytes.length}\0`);
    hash.update(bytes);
  }
  return hash.digest('hex');
}
