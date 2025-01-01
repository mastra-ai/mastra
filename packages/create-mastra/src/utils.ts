import fsExtra from 'fs-extra';
import { dirname } from 'path';
import path from 'path';
import { fileURLToPath } from 'url';

export async function getPackageVersion() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const pkgJsonPath = path.join(__dirname, '..', 'package.json');

  const content = await fsExtra.readJSON(pkgJsonPath);
  return content.version;
}
