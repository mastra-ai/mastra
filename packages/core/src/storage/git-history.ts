import { execFile } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { relative } from 'node:path';

/**
 * A single Git commit entry parsed from `git log` output.
 */
export interface GitCommit {
  /** Full commit SHA */
  hash: string;
  /** Commit author date as a Date object */
  date: Date;
  /** Author name */
  author: string;
  /** Commit subject line */
  message: string;
}

/**
 * Read-only utility for reading Git history of filesystem-stored JSON files.
 *
 * All operations are performed by shelling out to the `git` CLI via
 * `child_process.execFile` (no third-party dependencies). This class never
 * writes to Git — the user manages their own commits.
 *
 * Designed as a singleton shared across all domain helpers via a static field
 * on `FilesystemVersionedHelpers`.
 */
export class GitHistory {
  /** Cache: dir → repo root (string) or `false` if not a repo. */
  private repoRootCache = new Map<string, string | false>();

  /** Cache: `dir:filename:limit` → ordered commits (newest first). */
  private commitCache = new Map<string, GitCommit[]>();

  /** Cache: `dir:commitHash:filename` → parsed JSON. */
  private snapshotCache = new Map<string, Record<string, Record<string, unknown>>>();

  // ===========================================================================
  // Public API
  // ===========================================================================

  /**
   * Returns `true` if `dir` is inside a Git repository.
   * Result is cached after the first call per directory.
   */
  async isGitRepo(dir: string): Promise<boolean> {
    const cached = this.repoRootCache.get(dir);
    if (cached === false) return false;
    if (typeof cached === 'string') return true;

    try {
      const root = (await this.exec(dir, ['rev-parse', '--show-toplevel'])).trim();
      this.repoRootCache.set(dir, root);
      return true;
    } catch {
      this.repoRootCache.set(dir, false);
      return false;
    }
  }

  /**
   * Get the list of commits that touched a specific file, newest first.
   * Returns an empty array if Git is unavailable or the file has no history.
   *
   * @param dir      Absolute path to the storage directory
   * @param filename The JSON filename relative to `dir` (e.g., 'agents.json')
   * @param limit    Maximum number of commits to retrieve
   */
  async getFileHistory(dir: string, filename: string, limit: number = 50): Promise<GitCommit[]> {
    const cacheKey = `${dir}:${filename}:${limit}`;
    if (this.commitCache.has(cacheKey)) {
      return this.commitCache.get(cacheKey)!;
    }

    if (!(await this.isGitRepo(dir))) {
      this.commitCache.set(cacheKey, []);
      return [];
    }

    try {
      // `filename` is already relative to `dir`, and `exec` runs with `cwd: dir`,
      // so `git log -- <filename>` resolves correctly.
      const raw = await this.exec(dir, [
        'log',
        `--max-count=${limit}`,
        '--format=%H|%aI|%aN|%s',
        '--follow',
        '--',
        filename,
      ]);

      const commits: GitCommit[] = [];
      for (const line of raw.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        const pipeIdx1 = trimmed.indexOf('|');
        const pipeIdx2 = trimmed.indexOf('|', pipeIdx1 + 1);
        const pipeIdx3 = trimmed.indexOf('|', pipeIdx2 + 1);

        if (pipeIdx1 === -1 || pipeIdx2 === -1 || pipeIdx3 === -1) continue;

        commits.push({
          hash: trimmed.slice(0, pipeIdx1),
          date: new Date(trimmed.slice(pipeIdx1 + 1, pipeIdx2)),
          author: trimmed.slice(pipeIdx2 + 1, pipeIdx3),
          message: trimmed.slice(pipeIdx3 + 1),
        });
      }

      this.commitCache.set(cacheKey, commits);
      return commits;
    } catch {
      this.commitCache.set(cacheKey, []);
      return [];
    }
  }

  /**
   * Read and parse a JSON file at a specific Git commit.
   * Returns the parsed entity map, or `null` if the file didn't exist at that commit.
   *
   * @param dir        Absolute path to the storage directory
   * @param commitHash Full or abbreviated commit SHA
   * @param filename   The JSON filename relative to `dir` (e.g., 'agents.json')
   */
  async getFileAtCommit<T = Record<string, Record<string, unknown>>>(
    dir: string,
    commitHash: string,
    filename: string,
  ): Promise<T | null> {
    const cacheKey = `${dir}:${commitHash}:${filename}`;
    if (this.snapshotCache.has(cacheKey)) {
      return this.snapshotCache.get(cacheKey)! as T;
    }

    if (!(await this.isGitRepo(dir))) return null;

    try {
      const relPath = this.relativeToRepo(dir, filename);
      const raw = await this.exec(dir, ['show', `${commitHash}:${relPath}`]);
      const parsed = JSON.parse(raw) as Record<string, Record<string, unknown>>;
      this.snapshotCache.set(cacheKey, parsed);
      return parsed as T;
    } catch {
      return null;
    }
  }

  /**
   * Invalidate all caches. Call after external operations that change Git state
   * (e.g., the user commits or pulls).
   */
  invalidateCache(): void {
    this.repoRootCache.clear();
    this.commitCache.clear();
    this.snapshotCache.clear();
  }

  // ===========================================================================
  // Internals
  // ===========================================================================

  /**
   * Get the relative path from the Git repo root to a file in the storage directory.
   */
  private relativeToRepo(dir: string, filename: string): string {
    const root = this.repoRootCache.get(dir);
    if (!root) {
      throw new Error(`Not a git repository: ${dir}`);
    }
    // Resolve symlinks so that macOS /var → /private/var differences don't break relative()
    const realRoot = realpathSync(root);
    const realDir = realpathSync(dir);
    const relDir = relative(realRoot, realDir);
    return relDir ? `${relDir}/${filename}` : filename;
  }

  /**
   * Execute a git command and return stdout.
   */
  private exec(cwd: string, args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      execFile('git', args, { cwd, maxBuffer: 10 * 1024 * 1024 }, (error, stdout) => {
        if (error) reject(error);
        else resolve(stdout);
      });
    });
  }
}
