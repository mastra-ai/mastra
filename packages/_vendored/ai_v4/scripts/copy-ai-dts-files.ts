import { existsSync } from 'node:fs';
import { copyFile, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { exports as resolveExports } from 'resolve.exports';

type PackageJSON = {
  exports?: Record<string, string>;
};

async function readPackageJSON(pkgPath: string) {
  const packageJSONBuffer = await readFile(pkgPath, 'utf8');
  return JSON.parse(packageJSONBuffer) as PackageJSON;
}

function getDtsFile(pkg: PackageJSON, key: string, condition: string = 'types'): string | null {
  const exports = resolveExports(pkg, key, {
    conditions: [condition],
  });

  const dtsFile = (exports || [])[0];

  return dtsFile ?? null;
}

export async function copyAIDtsFiles(): Promise<string[]> {
  const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));

  const aiPkgDir = join(rootDir, 'node_modules', 'ai');
  const aiPkgJSON = await readPackageJSON(join(aiPkgDir, 'package.json'));
  const currentPkgJSON = await readPackageJSON(join(rootDir, 'package.json'));

  if (!aiPkgJSON.exports) {
    throw new Error('ai package.json does not have any exports');
  }

  const dtsFiles = [];
  for (const key of Object.keys(aiPkgJSON.exports)) {
    if (!key.startsWith('.')) {
      continue;
    }
    const aiDtsFile = getDtsFile(aiPkgJSON, key);
    const currentDtsFile = getDtsFile(currentPkgJSON, key);
    const currentJsFile = getDtsFile(currentPkgJSON, key, 'default');

    if (!aiDtsFile || !currentDtsFile || !currentJsFile || !existsSync(join(rootDir, currentJsFile))) {
      continue;
    }

    dtsFiles.push(join(rootDir, currentDtsFile));
    await copyFile(join(aiPkgDir, aiDtsFile), join(rootDir, currentDtsFile));
  }

  return dtsFiles;
}
