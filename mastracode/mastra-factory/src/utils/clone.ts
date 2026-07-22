import fs from 'node:fs/promises';
import path from 'node:path';
import { x } from 'tinyexec';

/** Rewrite the scaffolded package.json name to the chosen project name. */
export async function renameProject(projectPath: string, projectName: string): Promise<void> {
  const pkgPath = path.join(projectPath, 'package.json');
  const pkg = JSON.parse(await fs.readFile(pkgPath, 'utf8')) as Record<string, unknown>;
  pkg.name = toPackageName(projectName);
  await fs.writeFile(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
}

/** Best-effort conversion of a directory name into a valid npm package name. */
export function toPackageName(name: string): string {
  const cleaned = name
    .toLowerCase()
    .replace(/[^a-z0-9-_.~]+/g, '-')
    .replace(/^[-_.]+|[-_.]+$/g, '');
  return cleaned || 'mastra-factory';
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
}

async function directoryExists(dirPath: string): Promise<boolean> {
  try {
    return (await fs.stat(dirPath)).isDirectory();
  } catch {
    return false;
  }
}

export async function cloneTemplate(repoUrl: string, targetPath: string): Promise<void> {
  if (await pathExists(targetPath)) {
    throw new Error(`Directory ${path.basename(targetPath)} already exists`);
  }

  const tempRoot = await fs.mkdtemp(path.join(path.dirname(targetPath), `.${path.basename(targetPath)}-`));
  const tempTarget = path.join(tempRoot, 'template');

  try {
    try {
      const degitRepo = repoUrl.replace('https://github.com/', '');
      await x('npx', ['degit', degitRepo, tempTarget], {
        nodeOptions: { cwd: process.cwd() },
      });

      if ((await fs.readdir(tempTarget)).length === 0) {
        throw new Error('degit completed without cloning template files');
      }
    } catch {
      await fs.rm(tempTarget, { recursive: true, force: true });

      try {
        await x('git', ['clone', repoUrl, tempTarget], {
          nodeOptions: { cwd: process.cwd() },
        });

        const gitDir = path.join(tempTarget, '.git');
        if (await directoryExists(gitDir)) {
          await fs.rm(gitDir, { recursive: true, force: true });
        }
      } catch (gitError) {
        throw new Error(
          `Failed to clone repository: ${gitError instanceof Error ? gitError.message : 'Unknown error'}`,
        );
      }
    }

    if (await pathExists(targetPath)) {
      throw new Error(`Directory ${path.basename(targetPath)} already exists`);
    }
    await fs.rename(tempTarget, targetPath);
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
}
