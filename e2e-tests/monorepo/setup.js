import { spawnSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
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

export async function setupMonorepo(pathToStoreFiles) {
  const __dirname = dirname(fileURLToPath(import.meta.url));

  const monorepoPath = join(__dirname, 'template');
  const newPath = pathToStoreFiles;

  const pkgJsonMastraPath = join(__dirname, '..', '..').replaceAll('\\', '\\\\');

  await mkdir(newPath, { recursive: true });
  await cp(monorepoPath, newPath, { recursive: true });
  await cp(join(__dirname, '..', '..', 'tsconfig.node.json'), join(newPath, 'tsconfig.json'));

  // replace %%MASTRA_DIR%% with the new path
  await nestedReplace(newPath, pkgJsonMastraPath);

  console.log('Installing dependencies...');
  spawnSync('pnpm', ['install', '--shamefully-hoist'], {
    cwd: newPath,
    stdio: 'inherit',
    shell: true,
  });

  console.log('building mastra...');
  spawnSync('pnpm', ['build'], {
    cwd: join(newPath, 'apps', 'custom'),
    stdio: 'inherit',
    shell: true,
  });
}
