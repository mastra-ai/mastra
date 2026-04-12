import path, { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import fsExtra from 'fs-extra';

export async function getPackageVersion() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const pkgJsonPath = path.join(__dirname, '..', 'package.json');

  const content = await fsExtra.readJSON(pkgJsonPath);
  return content.version;
}
