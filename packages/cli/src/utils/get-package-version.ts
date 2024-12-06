import path, { dirname } from 'path';
import { PackageJson } from 'type-fest';
import { fileURLToPath } from 'url';

import fsExtra from 'fs-extra/esm';

export async function getPackageVersion() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const pkgJsonPath = path.join(__dirname, '..', '..', 'package.json');

  const content = (await fsExtra.readJSON(pkgJsonPath)) as PackageJson;
  return content.version;
}
