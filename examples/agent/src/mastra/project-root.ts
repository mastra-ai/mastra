import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

function findProjectRoot(startDir: string): string {
  let directory = startDir;

  while (directory !== dirname(directory)) {
    const hasPackageJson = existsSync(resolve(directory, 'package.json'));
    const isInsideMastraOutput = directory.includes('.mastra');
    if (hasPackageJson && !isInsideMastraOutput) return directory;
    directory = dirname(directory);
  }

  return startDir;
}

export const projectRoot = findProjectRoot(dirname(fileURLToPath(import.meta.url)));
