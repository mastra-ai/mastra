import { cp, lstat, mkdir, readFile, readlink, readdir, rm } from 'node:fs/promises';
import { basename, dirname, join, relative, resolve } from 'node:path';

function pathVariants(path: string) {
  const posix = path.replaceAll('\\', '/');
  const windows = path.replaceAll('/', '\\');
  return [path, posix, windows, `file://${posix}`, encodeURI(path), encodeURIComponent(path)];
}

export async function copyArtifact(options: {
  artifactRoot: string;
  destinationRoot: string;
  sourceRoots: string[];
  deleteRoots?: string[];
}) {
  const copiedRoot = join(options.destinationRoot, basename(options.artifactRoot));
  await mkdir(options.destinationRoot, { recursive: true });
  await cp(options.artifactRoot, copiedRoot, { recursive: true, dereference: false });
  for (const root of options.deleteRoots ?? []) await rm(root, { recursive: true, force: true });
  await assertNoSourceReferences(copiedRoot, options.sourceRoots);
  return copiedRoot;
}

async function assertNoSourceReferences(root: string, sourceRoots: string[]) {
  const needles = sourceRoots.flatMap(pathVariants).filter(value => value.length >= 4);
  const visit = async (directory: string): Promise<void> => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      const relativePath = relative(root, path).replaceAll('\\', '/');
      const stats = await lstat(path);
      if (stats.isDirectory()) {
        await visit(path);
        continue;
      }
      if (stats.isSymbolicLink()) {
        const target = await readlink(path);
        const resolvedTarget = resolve(dirname(path), target);
        if (needles.some(needle => target.includes(needle) || resolvedTarget.includes(needle))) {
          throw new Error(`Source path found in symlink ${relativePath}`);
        }
        continue;
      }
      const content = await readFile(path);
      for (const needle of needles) {
        if (content.includes(Buffer.from(needle)))
          throw new Error(`Source path found in artifact file ${relativePath}`);
      }
    }
  };
  await visit(root);
}
