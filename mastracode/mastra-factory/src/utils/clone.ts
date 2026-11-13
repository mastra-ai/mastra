import { readdirSync, statSync } from 'node:fs';
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

/**
 * True when the template can be scaffolded at `targetPath`: the path doesn't
 * exist yet, or it is an empty directory (e.g. the current directory).
 */
export function canScaffoldInto(targetPath: string): boolean {
  let stat;
  try {
    stat = statSync(targetPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return true;
    throw error;
  }
  return stat.isDirectory() && readdirSync(targetPath).every(entry => entry === '.DS_Store');
}

async function directoryExists(dirPath: string): Promise<boolean> {
  try {
    return (await fs.stat(dirPath)).isDirectory();
  } catch {
    return false;
  }
}

export async function cloneTemplate(repoUrl: string, targetPath: string): Promise<void> {
  if (!canScaffoldInto(targetPath)) {
    throw new Error(`Directory ${path.basename(targetPath)} already exists and isn't empty`);
  }

  const tempRoot = await fs.mkdtemp(path.join(path.dirname(targetPath), `.${path.basename(targetPath)}-`));
  const tempTarget = path.join(tempRoot, 'template');

  try {
    try {
      const degitRepo = repoUrl.replace('https://github.com/', '');
      await x('npx', ['degit', degitRepo, tempTarget], {
        throwOnError: true,
        nodeOptions: { cwd: process.cwd() },
      });

      if ((await fs.readdir(tempTarget)).length === 0) {
        throw new Error('degit completed without cloning template files');
      }
    } catch {
      await fs.rm(tempTarget, { recursive: true, force: true });

      try {
        await x('git', ['clone', repoUrl, tempTarget], {
          throwOnError: true,
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

    if (!canScaffoldInto(targetPath)) {
      throw new Error(`Directory ${path.basename(targetPath)} already exists and isn't empty`);
    }
    if (await directoryExists(targetPath)) {
      // Move the files in rather than replacing the directory, which may be the
      // user's current working directory.
      for (const entry of await fs.readdir(tempTarget)) {
        await fs.rename(path.join(tempTarget, entry), path.join(targetPath, entry));
      }
    } else {
      await fs.rename(tempTarget, targetPath);
    }
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
}
