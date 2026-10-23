import { readFile, writeFile } from 'node:fs/promises';
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

function getDtsFile(pkg: PackageJSON, key: string): string | null {
  const exports = resolveExports(pkg, key, {
    conditions: ['types'],
  });

  const dtsFile = (exports || []).find(f => f.endsWith('.d.ts'));

  return dtsFile ?? null;
}

// Newer `ai` releases emit namespace re-exports with inline `type` modifiers
// (e.g. `export { type output_Output as Output }`), which embedTypes mangles
// into invalid syntax. Modifiers are redundant in a .d.ts, so drop them.
function stripInlineTypeModifiers(dts: string): string {
  return dts.replace(/^(\s*export \{)([^}]*)(\};?)$/gm, (_, open: string, body: string, close: string) => {
    return `${open}${body.replace(/(^|,)(\s*)type\s+(?=[\w$])/g, '$1$2')}${close}`;
  });
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

    if (!aiDtsFile || !currentDtsFile) {
      continue;
    }

    dtsFiles.push(join(rootDir, currentDtsFile));
    const dts = await readFile(join(aiPkgDir, aiDtsFile), 'utf8');
    await writeFile(join(rootDir, currentDtsFile), stripInlineTypeModifiers(dts));
  }

  return dtsFiles;
}
