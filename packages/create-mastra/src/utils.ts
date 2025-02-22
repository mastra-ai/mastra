import fsExtra from 'fs-extra';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';

export async function getPackageVersion() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const pkgJsonPath = path.join(__dirname, '..', 'package.json');

  const content = await fsExtra.readJSON(pkgJsonPath);
  return content.version;
}

async function tryReadPackageJson(paths: string[]): Promise<any> {
  let lastError;
  for (const path of paths) {
    try {
      const content = await fsExtra.readJSON(path);
      if (content.name === 'create-mastra') {
        return content;
      }
    } catch (err) {
      lastError = err;
      continue;
    }
  }
  throw lastError || new Error('Could not find create-mastra package.json in any of the expected locations');
}

export async function getCreateVersionTag(): Promise<string | undefined> {
  try {
    const binPath = process.argv[1];
    const binDir = dirname(binPath);
    const possiblePaths = [
      // Direct parent paths
      path.join(binDir, '..', 'package.json'),
      path.join(binDir, '..', '..', 'package.json'),
      path.join(binDir, '..', '..', '..', 'package.json'),
      path.join(binDir, '..', '..', '..', '..', 'package.json'),

      // Standard node_modules paths
      path.join(binDir, '..', 'create-mastra', 'package.json'),
      path.join(binDir, '..', '..', 'create-mastra', 'package.json'),
      path.join(binDir, '..', '..', '..', 'create-mastra', 'package.json'),
      path.join(binDir, '..', '..', '..', '..', 'create-mastra', 'package.json'),

      // pnpm specific paths (.pnpm directory)
      path.join(binDir, '..', '.pnpm', 'create-mastra@*', 'node_modules', 'create-mastra', 'package.json'),
      path.join(binDir, '..', '..', '.pnpm', 'create-mastra@*', 'node_modules', 'create-mastra', 'package.json'),

      // pnpm dlx specific path
      path.join(binDir, '..', '..', 'package.json'),
      path.join(binDir, '..', '..', 'node_modules', 'create-mastra', 'package.json'),
    ];

    const content = await tryReadPackageJson(possiblePaths);

    if (content.version?.includes('-')) {
      const tag = content.version.split('-')[1].split('.')[0];
      return tag;
    }
  } catch (error) {
    console.error('We could not resolve the create-mastra version tag, falling back to "latest"', error);
  }

  return 'latest';
}
