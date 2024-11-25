import path from 'path';

import fs from 'fs/promises';

export async function getProjectName() {
  try {
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    const packageJson = await fs.readFile(packageJsonPath, 'utf-8');
    const pkg = JSON.parse(packageJson);
    return pkg.name;
  } catch (err) {
    throw err;
  }
}
