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
  return cleaned || 'software-factory';
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return false;
    }
    throw error;
  }
}

async function directoryExists(dirPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(dirPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

export async function cloneTemplate(repoUrl: string, targetPath: string): Promise<void> {
  if (await pathExists(targetPath)) {
    throw new Error(`Directory ${path.basename(targetPath)} already exists`);
  }

  try {
    // First try using degit if available
    const degitRepo = repoUrl.replace('https://github.com/', '');
    // If branch is specified, append it to the degit repo (format: owner/repo#branch)
    await x('npx', ['degit', degitRepo, targetPath], {
      nodeOptions: {
        cwd: process.cwd(),
      },
    });

    if ((await fs.readdir(targetPath)).length === 0) {
      throw new Error('degit completed without cloning template files');
    }
  } catch {
    // Degit can leave partial output behind, so reset only this clone-owned destination before the fallback.
    await fs.rm(targetPath, { recursive: true, force: true });

    // Fallback to git clone + remove .git
    try {
      const gitArgs = ['clone'];
      gitArgs.push(repoUrl, targetPath);

      await x('git', gitArgs, {
        nodeOptions: {
          cwd: process.cwd(),
        },
      });

      // Remove .git directory
      const gitDir = path.join(targetPath, '.git');
      if (await directoryExists(gitDir)) {
        await fs.rm(gitDir, { recursive: true, force: true });
      }
    } catch (gitError) {
      throw new Error(`Failed to clone repository: ${gitError instanceof Error ? gitError.message : 'Unknown error'}`);
    }
  }
}
