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

export async function getCreateVersionTag(): Promise<string | undefined> {
  try {
    const binPath = process.argv[1];
    const binDir = dirname(binPath);

    const pkgJsonPath = path.join(binDir, '..', 'create-mastra', 'package.json');

    const content = await fsExtra.readJSON(pkgJsonPath);

    if (content.version?.includes('-')) {
      const tag = content.version.split('-')[1].split('.')[0];
      return tag;
    }
  } catch (error) {
    console.error('Error reading package.json:', error);
  }

  return undefined;
}
