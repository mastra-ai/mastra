import { spawnSync } from 'node:child_process';
import { cp, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
async function nestedReplace(path, mastraPath) {
  const files = await readdir(path, {
    withFileTypes: true,
  });

  for (const file of files) {
    if (file.isDirectory()) {
      await nestedReplace(join(path, file.name), mastraPath);
    } else {
      if (file.name === 'package.json') {
        const content = await readFile(join(path, file.name), 'utf-8');
        await writeFile(join(path, file.name), content.replaceAll('%%MASTRA_DIR%%', mastraPath));
      }
    }
  }
}

export async function setupTestProject(pathToStoreFiles) {
  const __dirname = dirname(fileURLToPath(import.meta.url));

  const projectPath = join(__dirname, 'template');
  const newPath = pathToStoreFiles;

  const pkgJsonMastraPath = join(__dirname, '..', '..').replaceAll('\\', '\\\\');

  await mkdir(newPath, { recursive: true });
  await cp(projectPath, newPath, { recursive: true });

  // replace %%MASTRA_DIR%% with the new path
  await nestedReplace(newPath, pkgJsonMastraPath);

  console.log('Installing dependencies...');
  spawnSync('pnpm', ['install'], {
    cwd: newPath,
    stdio: 'inherit',
    shell: true,
  });
}
