import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { getWebGitCloneDirectoryName, normalizeWebGitUrl } from './git-clone-context.js';

const execFileAsync = promisify(execFile);
const DEFAULT_WEB_CLONES_DIR = path.join(os.tmpdir(), 'mastracode-web-clones');

function normalizeCloneParentPath(cloneParentPath?: string): string {
  if (!cloneParentPath) return DEFAULT_WEB_CLONES_DIR;

  const trimmed = cloneParentPath.trim();
  if (!trimmed) throw new Error('Clone location is required');
  if (/\p{C}/u.test(trimmed)) throw new Error('Clone location contains invalid characters');
  if (!path.isAbsolute(trimmed)) throw new Error('Clone location must be an absolute path');

  return path.resolve(trimmed);
}

export function getWebGitClonePath(gitUrl: string, cloneParentPath?: string): string {
  const normalizedGitUrl = normalizeWebGitUrl(gitUrl);
  const parentPath = normalizeCloneParentPath(cloneParentPath);
  const finalDir = path.join(parentPath, getWebGitCloneDirectoryName(normalizedGitUrl));

  if (path.relative(parentPath, finalDir).startsWith('..')) {
    throw new Error('Clone path must stay inside the selected location');
  }

  return finalDir;
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

export async function ensureWebGitClone(gitUrl: string, cloneParentPath?: string): Promise<string> {
  const normalizedGitUrl = normalizeWebGitUrl(gitUrl);
  const finalDir = getWebGitClonePath(normalizedGitUrl, cloneParentPath);
  const parentPath = path.dirname(finalDir);

  if (await pathExists(finalDir)) {
    return finalDir;
  }

  await fs.mkdir(parentPath, { recursive: true });
  const tempDir = await fs.mkdtemp(path.join(parentPath, `.${path.basename(finalDir)}-`));

  try {
    await execFileAsync('git', ['clone', '--depth', '1', normalizedGitUrl, tempDir], {
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    });
    try {
      await fs.rename(tempDir, finalDir);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if ((code === 'EEXIST' || code === 'ENOTEMPTY') && (await pathExists(finalDir))) {
        await fs.rm(tempDir, { recursive: true, force: true });
        return finalDir;
      }
      throw error;
    }
    return finalDir;
  } catch (error) {
    await fs.rm(tempDir, { recursive: true, force: true });
    throw error;
  }
}
