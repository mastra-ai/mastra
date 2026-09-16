import { cp, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { installWithRetry } from '../_local-registry-setup/install.js';

export async function setupTestProject(pathToStoreFiles) {
  const __dirname = dirname(fileURLToPath(import.meta.url));

  const projectPath = join(__dirname, 'template');
  const newPath = pathToStoreFiles;

  await mkdir(newPath, { recursive: true });
  await cp(projectPath, newPath, { recursive: true });

  console.log('Installing dependencies...');
  installWithRetry('pnpm', ['install', '--config.minimum-release-age=0'], { cwd: newPath });
}
