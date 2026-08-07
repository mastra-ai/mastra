/**
 * FactoryFilesystem — overlay that exposes a durable, factory-wide filesystem
 * inside a Factory session workspace.
 *
 * Paths under the reserved absolute prefix `/factory` route to a durable
 * backend (Platform bucket on deployments, LocalFilesystem in dev); every
 * other path delegates to the session's SandboxFilesystem untouched, so the
 * agent-visible repo paths and exec/cwd correspondence are preserved. Same
 * prefix-routing approach as FactorySkillSource in `./workspace.ts`.
 *
 * Agent-visible layout under the mount:
 *
 *   /factory/shared                                   org-wide shared files
 *   /factory/projects/<project>/shared                project-wide shared files
 *   /factory/projects/<project>/repos/<repo>/...      per-repo files
 *
 * Tenancy and isolation:
 * - The backing store nests everything under `orgs/<orgId>/` — that prefix is
 *   the tenancy wall and is never visible to agents.
 * - A session sees `/shared` and its own project's directory only. Sibling
 *   projects are hidden from listings and denied with FileNotFoundError so
 *   their existence doesn't leak.
 *
 * The durable backend is initialized lazily: MastraFilesystem providers call
 * `ensureReady()` inside every operation, so a misconfigured bucket surfaces
 * as a per-operation error instead of failing session materialization.
 */

import posixPath from 'node:path/posix';
import type {
  CopyOptions,
  FileContent,
  FileEntry,
  FileStat,
  FilesystemInfo,
  ListOptions,
  ReadOptions,
  RemoveOptions,
  WorkspaceFilesystem,
  WriteOptions,
} from '@mastra/core/workspace';
import { DirectoryNotFoundError, FileNotFoundError } from '@mastra/core/workspace';

/** Reserved agent-visible mount path for the durable factory filesystem. */
export const FACTORY_FS_MOUNT = '/factory';

/**
 * Sanitize a name into a single safe path segment: strip control chars,
 * collapse path separators, and refuse empty/dot segments.
 */
export function sanitizePathSegment(name: string): string {
  const cleaned = name
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[/\\]/g, '-')
    .trim();
  return cleaned === '' || cleaned === '.' || cleaned === '..' ? '_' : cleaned;
}

/** Directory name for a repository, derived from its `owner/repo` slug. */
export function repoDirName(repoSlug: string): string {
  return sanitizePathSegment(repoSlug.replace(/\//g, '__'));
}

export interface FactoryFilesystemOptions {
  /** The session's sandbox filesystem — receives every non-mount path. */
  inner: WorkspaceFilesystem;
  /** Durable backend the files live in (PlatformFilesystem / LocalFilesystem). */
  durable: WorkspaceFilesystem;
  /** Session org — becomes the invisible `orgs/<orgId>/` tenancy prefix. */
  orgId: string;
  /** Factory project name — its sanitized form is the project directory. */
  projectName: string;
  /** Repository slug (`owner/repo`) — becomes the session's repo directory. */
  repoSlug: string;
}

interface DurableRoute {
  /** Path inside the durable backend (org prefix applied). */
  backendPath: string;
  /** Normalized agent-visible subpath below the mount ('' = mount root). */
  subpath: string;
}

export class FactoryFilesystem implements WorkspaceFilesystem {
  readonly id: string;
  readonly name = 'FactoryFilesystem';
  readonly provider = 'factory';
  readonly basePath?: string;

  readonly #inner: WorkspaceFilesystem;
  readonly #durable: WorkspaceFilesystem;
  readonly #orgDir: string;
  readonly #projectDir: string;
  readonly #repoDir: string;

  constructor(options: FactoryFilesystemOptions) {
    this.#inner = options.inner;
    this.#durable = options.durable;
    this.#orgDir = sanitizePathSegment(options.orgId);
    this.#projectDir = sanitizePathSegment(options.projectName);
    this.#repoDir = repoDirName(options.repoSlug);
    this.id = `factory:${options.inner.id}`;
    this.basePath = options.inner.basePath;
  }

  get status() {
    return this.#inner.status;
  }

  // ── Routing ────────────────────────────────────────────────────────────

  /**
   * Resolve a path to its durable route, or null when it belongs to the inner
   * filesystem. Normalizes first so `/factory/../etc` escapes the mount
   * prefix (and therefore routes to the sandboxed inner filesystem) and `..`
   * inside the mount subtree can never climb out of the org prefix.
   */
  #route(inputPath: string): DurableRoute | null {
    if (!inputPath.startsWith('/')) return null;
    const normalized = posixPath.normalize(inputPath);
    if (normalized !== FACTORY_FS_MOUNT && !normalized.startsWith(`${FACTORY_FS_MOUNT}/`)) return null;
    // Backslashes are not separators to posix.normalize, but a Windows-hosted
    // local backend would treat `..\` as one — reject them outright so a mount
    // path can never smuggle a traversal past the org prefix.
    if (normalized.includes('\\')) throw new FileNotFoundError(inputPath);
    let subpath = normalized.slice(FACTORY_FS_MOUNT.length);
    if (subpath.startsWith('/')) subpath = subpath.slice(1);
    if (subpath.endsWith('/')) subpath = subpath.slice(0, -1);
    this.#assertVisible(subpath, inputPath);
    return {
      subpath,
      // Relative on purpose: LocalFilesystem resolves relative paths against
      // its basePath (absolute ones are host paths and get rejected), and
      // PlatformFilesystem treats both forms as bucket-root-relative.
      backendPath: posixPath.join('orgs', this.#orgDir, subpath),
    };
  }

  /**
   * Enforce the session's view: `/shared/**`, `/projects`, and
   * `/projects/<own>/**` are visible; everything else under the mount is
   * denied as not-found so other projects' existence doesn't leak.
   */
  #assertVisible(subpath: string, inputPath: string): void {
    if (subpath === '') return;
    const [head, second] = subpath.split('/');
    if (head === 'shared') return;
    if (head === 'projects') {
      if (second === undefined || second === this.#projectDir) return;
      throw new FileNotFoundError(inputPath);
    }
    throw new FileNotFoundError(inputPath);
  }

  /**
   * Directories that exist by definition in the mount's layout even when the
   * durable backend has no objects under them yet (bucket "directories" are
   * virtual and empty ones don't exist).
   */
  #isVirtualDir(subpath: string): boolean {
    return [
      '',
      'shared',
      'projects',
      `projects/${this.#projectDir}`,
      `projects/${this.#projectDir}/shared`,
      `projects/${this.#projectDir}/repos`,
      `projects/${this.#projectDir}/repos/${this.#repoDir}`,
    ].includes(subpath);
  }

  /**
   * The layout's own directories must never be created/overwritten as files —
   * on a local backend a file at `orgs/<org>/shared` would wedge every write
   * under `/shared/…` with ENOTDIR until it is manually deleted.
   */
  #assertNotVirtualDir(subpath: string, inputPath: string): void {
    if (this.#isVirtualDir(subpath)) {
      throw new Error(`Reserved factory filesystem directory, not a file: ${inputPath}`);
    }
  }

  #virtualDirStat(subpath: string): FileStat {
    return {
      name: subpath === '' ? 'factory' : posixPath.basename(subpath),
      path: posixPath.join(FACTORY_FS_MOUNT, subpath),
      type: 'directory',
      size: 0,
      createdAt: new Date(0),
      modifiedAt: new Date(0),
    };
  }

  #isNotFound(error: unknown): boolean {
    return error instanceof FileNotFoundError || error instanceof DirectoryNotFoundError;
  }

  // ── Session path helpers (used for instructions/wiring) ────────────────

  /** Agent-visible directory for this session's project. */
  get projectPath(): string {
    return `${FACTORY_FS_MOUNT}/projects/${this.#projectDir}`;
  }

  /** Agent-visible directory for this session's repository. */
  get repoPath(): string {
    return `${this.projectPath}/repos/${this.#repoDir}`;
  }

  // ── File operations ────────────────────────────────────────────────────

  async readFile(path: string, options?: ReadOptions): Promise<string | Buffer> {
    const route = this.#route(path);
    return route ? this.#durable.readFile(route.backendPath, options) : this.#inner.readFile(path, options);
  }

  async writeFile(path: string, content: FileContent, options?: WriteOptions): Promise<void> {
    const route = this.#route(path);
    if (!route) return this.#inner.writeFile(path, content, options);
    this.#assertNotVirtualDir(route.subpath, path);
    return this.#durable.writeFile(route.backendPath, content, options);
  }

  async appendFile(path: string, content: FileContent): Promise<void> {
    const route = this.#route(path);
    if (!route) return this.#inner.appendFile(path, content);
    this.#assertNotVirtualDir(route.subpath, path);
    return this.#durable.appendFile(route.backendPath, content);
  }

  async deleteFile(path: string, options?: RemoveOptions): Promise<void> {
    const route = this.#route(path);
    if (!route) return this.#inner.deleteFile(path, options);
    this.#assertNotVirtualDir(route.subpath, path);
    return this.#durable.deleteFile(route.backendPath, options);
  }

  async copyFile(src: string, dest: string, options?: CopyOptions): Promise<void> {
    const srcRoute = this.#route(src);
    const destRoute = this.#route(dest);
    if (srcRoute && destRoute) return this.#durable.copyFile(srcRoute.backendPath, destRoute.backendPath, options);
    if (!srcRoute && !destRoute) return this.#inner.copyFile(src, dest, options);
    // Cross-boundary copy (sandbox ↔ mount): read from one side, write to the other.
    if (options?.overwrite === false && (await this.exists(dest)))
      throw new Error(`Destination already exists: ${dest}`);
    const content = await this.readFile(src);
    await this.writeFile(dest, content);
  }

  async moveFile(src: string, dest: string, options?: CopyOptions): Promise<void> {
    const srcRoute = this.#route(src);
    const destRoute = this.#route(dest);
    if (srcRoute && destRoute) return this.#durable.moveFile(srcRoute.backendPath, destRoute.backendPath, options);
    if (!srcRoute && !destRoute) return this.#inner.moveFile(src, dest, options);
    await this.copyFile(src, dest, options);
    await this.deleteFile(src);
  }

  // ── Directory operations ───────────────────────────────────────────────

  async mkdir(path: string, options?: { recursive?: boolean }): Promise<void> {
    const route = this.#route(path);
    return route ? this.#durable.mkdir(route.backendPath, options) : this.#inner.mkdir(path, options);
  }

  async rmdir(path: string, options?: RemoveOptions): Promise<void> {
    const route = this.#route(path);
    if (!route) return this.#inner.rmdir(path, options);
    // The layout's own directories are permanent — refuse to remove them.
    if (this.#isVirtualDir(route.subpath))
      throw new Error(`Cannot remove reserved factory filesystem directory: ${path}`);
    return this.#durable.rmdir(route.backendPath, options);
  }

  async readdir(path: string, options?: ListOptions): Promise<FileEntry[]> {
    const route = this.#route(path);
    if (!route) return this.#inner.readdir(path, options);
    // The mount root and /projects are synthesized: they always list the
    // layout's directories and never expose sibling projects, regardless of
    // what exists in the backend. (Recursion stops at this virtual level.)
    if (route.subpath === '') {
      return [
        { name: 'shared', type: 'directory' },
        { name: 'projects', type: 'directory' },
      ];
    }
    if (route.subpath === 'projects') {
      return [{ name: this.#projectDir, type: 'directory' }];
    }
    try {
      return await this.#durable.readdir(route.backendPath, options);
    } catch (error) {
      // Layout directories exist by definition even when the backend has no
      // objects under them yet.
      if (this.#isNotFound(error) && this.#isVirtualDir(route.subpath)) return [];
      throw error;
    }
  }

  // ── Path operations ────────────────────────────────────────────────────

  resolveAbsolutePath(path: string): string | undefined {
    // Mount files live in a remote/durable backend — no host disk path to resolve.
    if (this.#route(path)) return undefined;
    return this.#inner.resolveAbsolutePath?.(path);
  }

  async realpath(path: string): Promise<string> {
    const route = this.#route(path);
    if (route) return posixPath.join(FACTORY_FS_MOUNT, route.subpath);
    return this.#inner.realpath ? this.#inner.realpath(path) : path;
  }

  async exists(path: string): Promise<boolean> {
    let route: DurableRoute;
    try {
      const resolved = this.#route(path);
      if (!resolved) return this.#inner.exists(path);
      route = resolved;
    } catch (error) {
      // Hidden sibling project (or unknown top-level mount path) — report
      // absent rather than erroring so existence doesn't leak.
      if (this.#isNotFound(error)) return false;
      throw error;
    }
    if (this.#isVirtualDir(route.subpath)) return true;
    return this.#durable.exists(route.backendPath);
  }

  async stat(path: string): Promise<FileStat> {
    const route = this.#route(path);
    if (!route) return this.#inner.stat(path);
    try {
      const stat = await this.#durable.stat(route.backendPath);
      // Re-root the reported path into the agent-visible namespace.
      return { ...stat, path: posixPath.join(FACTORY_FS_MOUNT, route.subpath) };
    } catch (error) {
      if (this.#isNotFound(error) && this.#isVirtualDir(route.subpath)) return this.#virtualDirStat(route.subpath);
      throw error;
    }
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────

  async init(): Promise<void> {
    // Only the inner filesystem is initialized eagerly. The durable backend
    // self-initializes on first use (MastraFilesystem.ensureReady), keeping a
    // misconfigured bucket from blocking session materialization.
    await this.#inner.init?.();
  }

  async destroy(): Promise<void> {
    await this.#inner.destroy?.();
  }

  async getInfo(): Promise<FilesystemInfo> {
    return {
      id: this.id,
      name: this.name,
      provider: this.provider,
      status: this.status,
      metadata: {
        mount: FACTORY_FS_MOUNT,
        inner: (await this.#inner.getInfo?.()) ?? null,
        durableProvider: this.#durable.provider,
      },
    };
  }

  getInstructions(): string {
    const innerInstructions =
      this.#inner.getInstructions?.() ??
      `Files are stored in a remote sandbox. Use absolute workspace paths like /src/index.ts.`;
    return [
      innerInstructions,
      `Additionally, ${FACTORY_FS_MOUNT} is a DURABLE filesystem mount: files written there outlive this sandbox and are shared with other factory sessions. Anything worth persisting outside version control can live there — for example plans, notes, triage handoffs, or scratch data. How you organize it is up to you and the user.`,
      `Your writable locations: ${FACTORY_FS_MOUNT}/shared (org-wide), ${this.projectPath}/shared (project-wide), and ${this.repoPath} (this repository).`,
      `IMPORTANT: shell commands cannot see ${FACTORY_FS_MOUNT} — it is not a real directory in the sandbox. Read, write, list, and search it with the workspace file tools only.`,
    ].join('\n');
  }
}
