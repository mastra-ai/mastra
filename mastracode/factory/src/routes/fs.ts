import { lstat, open, readdir, realpath, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { isAbsolute, join, posix as posixPath, resolve, sep } from 'node:path';

import { SandboxFilesystem } from '@mastra/code-sdk/agents/sandbox-filesystem';
import { detectProject, getResourceIdOverride } from '@mastra/code-sdk/utils/project';
import { registerApiRoute } from '@mastra/core/server';
import type { ApiRoute } from '@mastra/core/server';
import type { Context } from 'hono';

import type { SandboxFleet } from '../sandbox/fleet.js';
import type { SourceControlSession } from '../storage/domains/source-control/base.js';
import type { RouteAuth } from './route.js';

/**
 * Server-side directory browser for the web project picker.
 *
 * The browser cannot read absolute filesystem paths (the File System Access API
 * only exposes a directory *name*), so the picker must ask the server — which
 * does have filesystem access — to enumerate directories. The result is real
 * absolute paths the user can select without typing.
 *
 * All access is confined to a configured `root` (default: the user's home
 * directory). Requests that try to escape the root via `..` or symlinks are
 * clamped back to the root.
 */

export interface DirectoryEntry {
  name: string;
  /** Absolute path to the entry. */
  path: string;
}

export interface DirectoryListing {
  /** The allowed root; clients cannot browse above this. */
  root: string;
  /** The absolute path that was listed. */
  path: string;
  /** Parent directory path, or null when `path` is the root. */
  parent: string | null;
  /** Subdirectories of `path` (directories only, sorted, hidden excluded). */
  entries: DirectoryEntry[];
}

export interface WorkspaceRenderedEntry {
  name: string;
  /** Path relative to the configured rendered root. */
  path: string;
  type: 'file' | 'directory';
  size: number;
  updatedAt: string;
}

export interface WorkspaceRenderedListing {
  /** The confined workspace/project root. */
  workspacePath: string;
  /** Configured workspace-relative rendered root, e.g. `.artifacts`. */
  root: string;
  /** The confined absolute path for the rendered root. */
  rootPath: string;
  entries: WorkspaceRenderedEntry[];
}

export interface WorkspaceFile {
  /** The confined workspace/project root. */
  workspacePath: string;
  /** Workspace-relative file path. */
  path: string;
  name: string;
  size: number;
  updatedAt: string;
  contentType: 'text' | 'unsupported';
  content?: string;
  truncated?: boolean;
}

export type ArtifactEntry = WorkspaceRenderedEntry;

export interface ArtifactListing {
  /** The confined workspace/project root. */
  rootPath: string;
  /** The workspace artifact directory. */
  artifactsPath: string;
  entries: ArtifactEntry[];
}

const MAX_TEXT_FILE_BYTES = 512 * 1024;
const TEXT_DECODER = new TextDecoder('utf-8', { fatal: true });
const APPROVED_RENDERED_ROOTS = new Set(['.artifacts']);

/** Erase a route handler's path-parameterized context to a plain `Context`. */
function loose(c: unknown): Context {
  return c as Context;
}

/** Resolve the browsable root, defaulting to the user's home directory. */
export function resolveFsRoot(root?: string): string {
  return resolve(root && root.trim() ? root : homedir());
}

/** True when `candidate` is `root` or nested under it. */
function isWithinRoot(candidate: string, root: string): boolean {
  if (candidate === root) return true;
  const rootWithSep = root.endsWith(sep) ? root : root + sep;
  return candidate.startsWith(rootWithSep);
}

async function realOrResolved(path: string): Promise<string> {
  try {
    return await realpath(path);
  } catch {
    return path;
  }
}

/**
 * Resolve a path's real location (following symlinks) and confirm it stays
 * within `root`. Returns the real path when confined, or `null` when it escapes
 * the root or does not exist. Used so a symlink inside the root that points
 * outside it cannot be browsed or selected.
 */
async function realPathWithinRoot(candidate: string, root: string): Promise<string | null> {
  try {
    const real = await realpath(candidate);
    return isWithinRoot(real, root) ? real : null;
  } catch {
    return null;
  }
}

function assertRelativePath(path: string, label: string): string {
  const trimmed = path.trim();
  if (!trimmed) throw new Error(`Missing required query param: ${label}`);
  if (isAbsolute(trimmed)) throw new Error(`${label} must be relative`);
  if (trimmed.split(/[\\/]+/).includes('..')) throw new Error(`${label} escapes workspace`);
  const normalized = resolve('/', trimmed).slice(1);
  if (!normalized || normalized === '..' || normalized.startsWith(`..${sep}`))
    throw new Error(`${label} escapes workspace`);
  return normalized;
}

function assertApprovedRenderedRoot(renderedRoot: string): string {
  const safeRoot = assertRelativePath(renderedRoot, 'root');
  if (!APPROVED_RENDERED_ROOTS.has(safeRoot)) throw new Error('Root is not approved for rendered workspace access');
  return safeRoot;
}

async function confinedWorkspacePath(
  root: string,
  workspacePath: string,
): Promise<{ resolvedRoot: string; workspace: string }> {
  const resolvedRoot = await realOrResolved(resolveFsRoot(root));
  const candidate = isAbsolute(workspacePath) ? resolve(workspacePath) : resolve(resolvedRoot, workspacePath);
  const workspace = await realPathWithinRoot(candidate, resolvedRoot);
  if (!workspace) throw new Error('Path is outside the browsable root');
  return { resolvedRoot, workspace };
}

async function confinedWorkspaceRelativePath(
  root: string,
  workspacePath: string,
  relativePath: string,
): Promise<{ workspace: string; path: string; relativePath: string }> {
  const safeRelativePath = assertRelativePath(relativePath, 'path');
  const { workspace } = await confinedWorkspacePath(root, workspacePath);
  const candidate = resolve(workspace, safeRelativePath);
  if (!isWithinRoot(candidate, workspace)) throw new Error('Path escapes workspace');
  const confinedPath = await realPathWithinRoot(candidate, workspace);
  if (!confinedPath) throw new Error('Path is outside the workspace');
  return { workspace, path: confinedPath, relativePath: safeRelativePath };
}

/**
 * List the directories inside `requestedPath`, confined to `root`. An absent or
 * out-of-root path is clamped to the root, so the worst a malicious client can
 * do is browse within the allowed root.
 */
export async function listDirectory(root: string, requestedPath?: string): Promise<DirectoryListing> {
  // Resolve the root through symlinks so all confinement checks compare real
  // paths; a symlink that escapes the root is then reliably detectable.
  const resolvedRoot = await realOrResolved(resolveFsRoot(root));

  let target = resolvedRoot;
  if (requestedPath && requestedPath.trim()) {
    const candidate = isAbsolute(requestedPath) ? resolve(requestedPath) : resolve(resolvedRoot, requestedPath);
    // Follow symlinks and re-confirm the real target stays within the root.
    target = (await realPathWithinRoot(candidate, resolvedRoot)) ?? resolvedRoot;
  }

  // Confirm the target is a real directory; fall back to root otherwise.
  try {
    const info = await stat(target);
    if (!info.isDirectory()) target = resolvedRoot;
  } catch {
    target = resolvedRoot;
  }

  const dirents = await readdir(target, { withFileTypes: true });
  const entries: DirectoryEntry[] = [];
  for (const dirent of dirents) {
    if (dirent.name.startsWith('.')) continue; // skip dotfiles/dirs
    const entryPath = join(target, dirent.name);
    let isDir = dirent.isDirectory();
    if (dirent.isSymbolicLink()) {
      // Only surface symlinks whose real target is a directory inside the root,
      // so a link pointing outside the root can't be browsed or selected.
      const real = await realPathWithinRoot(entryPath, resolvedRoot);
      isDir = real ? (await stat(real).catch(() => null))?.isDirectory() === true : false;
    }
    if (isDir) entries.push({ name: dirent.name, path: entryPath });
  }
  entries.sort((a, b) => a.name.localeCompare(b.name));

  const parent = target === resolvedRoot ? null : resolve(target, '..');

  return { root: resolvedRoot, path: target, parent, entries };
}

async function listRenderedEntries(rootPath: string, currentPath = rootPath): Promise<WorkspaceRenderedEntry[]> {
  const dirents = await readdir(currentPath, { withFileTypes: true });
  const entries: WorkspaceRenderedEntry[] = [];

  for (const dirent of dirents) {
    const entryPath = join(currentPath, dirent.name);
    const info = await lstat(entryPath);
    const relativePath = entryPath.slice(rootPath.length + 1);

    if (info.isDirectory()) {
      entries.push({
        name: dirent.name,
        path: relativePath,
        type: 'directory',
        size: info.size,
        updatedAt: info.mtime.toISOString(),
      });
      entries.push(...(await listRenderedEntries(rootPath, entryPath)));
      continue;
    }

    if (info.isFile()) {
      entries.push({
        name: dirent.name,
        path: relativePath,
        type: 'file',
        size: info.size,
        updatedAt: info.mtime.toISOString(),
      });
    }
  }

  return entries.sort((a, b) => a.path.localeCompare(b.path));
}

export async function listWorkspaceRenderedPath(
  root: string,
  workspacePath: string,
  renderedRoot: string,
): Promise<WorkspaceRenderedListing> {
  const safeRoot = assertApprovedRenderedRoot(renderedRoot);
  const { workspace } = await confinedWorkspacePath(root, workspacePath);
  const renderedPath = resolve(workspace, safeRoot);
  if (!isWithinRoot(renderedPath, workspace)) throw new Error('Root escapes workspace');

  const confinedRootPath = await realPathWithinRoot(renderedPath, workspace);
  if (!confinedRootPath) return { workspacePath: workspace, root: safeRoot, rootPath: renderedPath, entries: [] };

  const info = await stat(confinedRootPath);
  if (!info.isDirectory()) return { workspacePath: workspace, root: safeRoot, rootPath: confinedRootPath, entries: [] };

  return {
    workspacePath: workspace,
    root: safeRoot,
    rootPath: confinedRootPath,
    entries: await listRenderedEntries(confinedRootPath),
  };
}

export async function readWorkspaceFile(root: string, workspacePath: string, path: string): Promise<WorkspaceFile> {
  const safePath = assertRelativePath(path, 'path');
  const relativeRoot = safePath.split('/')[0] ?? '';
  assertApprovedRenderedRoot(relativeRoot);
  return readConfinedWorkspaceFile(root, workspacePath, path);
}

/**
 * Read a workspace-relative file, confined to the workspace (and browsable
 * root) but WITHOUT the rendered-root allowlist check. Callers must enforce
 * their own path allowlist before calling (see `readWorkspaceFile` and the
 * plans routes).
 */
export async function readConfinedWorkspaceFile(
  root: string,
  workspacePath: string,
  path: string,
): Promise<WorkspaceFile> {
  const {
    workspace,
    path: confinedPath,
    relativePath,
  } = await confinedWorkspaceRelativePath(root, workspacePath, path);
  const info = await lstat(confinedPath);
  if (info.isDirectory()) throw new Error('Path is a directory');
  if (!info.isFile()) throw new Error('Unsupported file type');

  const bytesToRead = Math.min(info.size, MAX_TEXT_FILE_BYTES);
  const contentBuffer = Buffer.alloc(bytesToRead);
  const handle = await open(confinedPath, 'r');
  try {
    await handle.read(contentBuffer, 0, bytesToRead, 0);
  } finally {
    await handle.close();
  }

  try {
    const content = TEXT_DECODER.decode(contentBuffer);
    return {
      workspacePath: workspace,
      path: relativePath,
      name: relativePath.split('/').pop() ?? relativePath,
      size: info.size,
      updatedAt: info.mtime.toISOString(),
      contentType: 'text',
      content,
      truncated: info.size > MAX_TEXT_FILE_BYTES,
    };
  } catch {
    return {
      workspacePath: workspace,
      path: relativePath,
      name: relativePath.split('/').pop() ?? relativePath,
      size: info.size,
      updatedAt: info.mtime.toISOString(),
      contentType: 'unsupported',
    };
  }
}

export async function listArtifacts(root: string, workspacePath: string): Promise<ArtifactListing> {
  const listing = await listWorkspaceRenderedPath(root, workspacePath, '.artifacts');
  return {
    rootPath: listing.workspacePath,
    artifactsPath: listing.rootPath,
    entries: listing.entries,
  };
}

// ── Session-backed workspace access ──────────────────────────────────────────
//
// The web UI identifies a Factory session workspace by its session id (a UUID),
// not by a server-local filesystem path — the session's files live inside the
// session's sandbox (a remote VM on deployed factories). These helpers resolve
// the session, enforce that the caller owns it, reattach to its sandbox, and
// serve the approved rendered roots through `SandboxFilesystem`.

/** Dependencies for resolving a `workspacePath` that is a Factory session id. */
export interface SessionFsDeps {
  auth: RouteAuth;
  fleet: SandboxFleet;
  sessions: { getBySessionId(sessionId: string): Promise<SourceControlSession | null> };
}

/**
 * Resolve a `workspacePath` query param as a Factory session id. Returns the
 * session when one exists and the caller owns it, `null` when no session
 * matches (the caller should fall back to local-path handling), and throws
 * when a session exists but belongs to another tenant.
 */
export async function resolveAuthorizedSession(
  c: Context,
  deps: SessionFsDeps | undefined,
  workspacePath: string,
): Promise<SourceControlSession | null> {
  if (!deps) return null;
  const session = await deps.sessions.getBySessionId(workspacePath);
  if (!session) return null;
  if (deps.auth.enabled()) {
    await deps.auth.ensureUser(c);
    const tenant = deps.auth.tenant(c);
    if (!tenant || tenant.orgId !== session.orgId || tenant.userId !== session.userId) {
      throw new Error('Session is not available to the current user');
    }
  }
  return session;
}

interface SessionSandboxHandle {
  sandbox: { executeCommand(command: string, args?: string[], options?: { timeout?: number }): Promise<unknown> };
  filesystem: SandboxFilesystem;
  workdir: string;
}

/**
 * Reattach to the session's sandbox and wrap its workdir in a
 * `SandboxFilesystem`. Returns `null` when the session has no provisioned
 * sandbox yet (nothing materialized → nothing to list), or when the sandbox
 * can no longer be reattached (e.g. torn down by the provider's idle GC).
 * This is a passive read path, so it never re-provisions: the session's
 * filesystem is preserved in its provider checkpoint and comes back the next
 * time the workspace is actually opened (e.g. by sending a message).
 */
async function sessionSandbox(
  fleet: SandboxFleet,
  session: SourceControlSession,
): Promise<SessionSandboxHandle | null> {
  if (!fleet.enabled || !session.sandboxId || !session.sandboxWorkdir) return null;
  let sandbox: Awaited<ReturnType<SandboxFleet['reattachSandbox']>>;
  try {
    sandbox = await fleet.reattachSandbox(session.sandboxId, { workingDirectory: session.sandboxWorkdir });
  } catch {
    // Sandbox is gone (idle GC) or unreachable. Degrade to an empty view
    // rather than surfacing a 500 from a file-viewer panel.
    return null;
  }
  return {
    sandbox,
    filesystem: new SandboxFilesystem({ sandbox, workdir: session.sandboxWorkdir }),
    workdir: session.sandboxWorkdir,
  };
}

/** List an approved rendered root inside a Factory session's sandbox workdir. */
export async function listSessionRenderedPath(
  fleet: SandboxFleet,
  session: SourceControlSession,
  renderedRoot: string,
): Promise<WorkspaceRenderedListing> {
  const safeRoot = assertApprovedRenderedRoot(renderedRoot);
  const rootPath = posixPath.join(session.sandboxWorkdir ?? '', safeRoot);
  const empty: WorkspaceRenderedListing = { workspacePath: session.sessionId, root: safeRoot, rootPath, entries: [] };

  const handle = await sessionSandbox(fleet, session);
  if (!handle) return empty;

  // One round trip: emit "type\tsize\tmtime\tpath" per entry. `safeRoot` comes
  // from a fixed allowlist so interpolating it (quoted) is safe.
  const quotedRoot = `'${rootPath.replace(/'/g, `'\\''`)}'`;
  const result = (await handle.sandbox.executeCommand(
    'sh',
    [
      '-c',
      `test -d ${quotedRoot} && find ${quotedRoot} -mindepth 1 -printf '%y\\t%s\\t%T@\\t%p\\n' 2>/dev/null || true`,
    ],
    { timeout: 30_000 },
  )) as { exitCode: number; stdout: string };
  if (result.exitCode !== 0) return empty;

  const entries: WorkspaceRenderedEntry[] = [];
  for (const line of result.stdout.split('\n')) {
    if (!line) continue;
    const [type, sizeStr, mtimeStr, ...pathParts] = line.split('\t');
    const fullPath = pathParts.join('\t');
    if (!fullPath || !fullPath.startsWith(`${rootPath}/`)) continue;
    const relativePath = fullPath.slice(rootPath.length + 1);
    entries.push({
      name: posixPath.basename(relativePath),
      path: relativePath,
      type: type === 'd' ? 'directory' : 'file',
      size: type === 'd' ? 0 : Number(sizeStr) || 0,
      updatedAt: new Date((Number(mtimeStr) || 0) * 1000).toISOString(),
    });
  }
  entries.sort((a, b) => a.path.localeCompare(b.path));

  return { workspacePath: session.sessionId, root: safeRoot, rootPath, entries };
}

/** Read a file under an approved rendered root inside a session's sandbox. */
export async function readSessionWorkspaceFile(
  fleet: SandboxFleet,
  session: SourceControlSession,
  path: string,
): Promise<WorkspaceFile> {
  const safePath = assertRelativePath(path, 'path');
  assertApprovedRenderedRoot(safePath.split('/')[0] ?? '');
  return readConfinedSessionWorkspaceFile(fleet, session, path);
}

/**
 * Read a file inside a session's sandbox workdir WITHOUT the rendered-root
 * allowlist check. Callers must enforce their own path allowlist before
 * calling (see `readSessionWorkspaceFile` and the plans routes).
 */
export async function readConfinedSessionWorkspaceFile(
  fleet: SandboxFleet,
  session: SourceControlSession,
  path: string,
): Promise<WorkspaceFile> {
  const safePath = assertRelativePath(path, 'path');

  const handle = await sessionSandbox(fleet, session);
  if (!handle) throw new Error('Session workspace is not available');
  const { filesystem } = handle;
  const info = await filesystem.stat(safePath);
  if (info.type === 'directory') throw new Error('Path is a directory');

  const buffer = (await filesystem.readFile(safePath)) as Buffer;
  const truncated = buffer.length > MAX_TEXT_FILE_BYTES;
  const base = {
    workspacePath: session.sessionId,
    path: safePath,
    name: posixPath.basename(safePath),
    size: buffer.length,
    updatedAt: info.modifiedAt.toISOString(),
  };
  try {
    const content = TEXT_DECODER.decode(truncated ? buffer.subarray(0, MAX_TEXT_FILE_BYTES) : buffer);
    return { ...base, contentType: 'text', content, truncated };
  } catch {
    return { ...base, contentType: 'unsupported' };
  }
}

export interface ResolvedCodebase {
  /**
   * The resourceId the TUI would use for this path — derived identically so a
   * project opened in the terminal and in the web app resolve to the SAME
   * session (and therefore the same threads).
   */
  resourceId: string;
  name: string;
  rootPath: string;
  gitUrl?: string;
  gitBranch?: string;
}

/**
 * Resolve a project path to the same resourceId the TUI uses. Mirrors
 * `createMastraCode`: detect the project, then apply any resourceId override
 * (MASTRA_RESOURCE_ID env var or `.mastracode/database.json`). This is the
 * shared continuity point — start in the TUI, continue on the web, same path
 * → same resourceId → same session.
 */
export function resolveCodebase(projectPath: string): ResolvedCodebase {
  const info = detectProject(projectPath);
  const override = getResourceIdOverride(info.rootPath);
  return {
    resourceId: override ?? info.resourceId,
    name: info.name,
    rootPath: info.rootPath,
    gitUrl: info.gitUrl,
    gitBranch: info.gitBranch,
  };
}

/**
 * Build the web filesystem routes as Mastra `apiRoutes`:
 *   - `GET /web/fs/list?path=...`        — browse directories (confined to root)
 *   - `GET /web/codebase/resolve?path=...` — TUI-compatible codebase resourceId
 */
export function buildFsRoutes(options: { root?: string; sessionFs?: SessionFsDeps } = {}): ApiRoute[] {
  const root = resolveFsRoot(options.root);
  const sessionFs = options.sessionFs;

  return [
    registerApiRoute('/web/fs/list', {
      method: 'GET',
      requiresAuth: false,
      handler: async c => {
        const path = c.req.query('path');
        try {
          const listing = await listDirectory(root, path);
          return c.json(listing);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          return c.json({ error: message }, 500);
        }
      },
    }),
    registerApiRoute('/web/artifacts/list', {
      method: 'GET',
      requiresAuth: false,
      handler: async c => {
        const path = c.req.query('path');
        if (!path) return c.json({ error: 'Missing required query param: path' }, 400);
        try {
          return c.json(await listArtifacts(root, path));
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          const status = message === 'Path is outside the browsable root' ? 403 : 500;
          return c.json({ error: message }, status);
        }
      },
    }),
    registerApiRoute('/web/workspace/rendered/list', {
      method: 'GET',
      requiresAuth: false,
      handler: async c => {
        const workspacePath = c.req.query('workspacePath');
        const renderedRoot = c.req.query('root');
        if (!workspacePath) return c.json({ error: 'Missing required query param: workspacePath' }, 400);
        if (!renderedRoot) return c.json({ error: 'Missing required query param: root' }, 400);
        try {
          const session = await resolveAuthorizedSession(loose(c), sessionFs, workspacePath);
          if (session && sessionFs) {
            return c.json(await listSessionRenderedPath(sessionFs.fleet, session, renderedRoot));
          }
          return c.json(await listWorkspaceRenderedPath(root, workspacePath, renderedRoot));
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          const status =
            message.includes('outside') ||
            message.includes('relative') ||
            message.includes('escapes') ||
            message.includes('not approved') ||
            message.includes('not available')
              ? 403
              : 500;
          return c.json({ error: message }, status);
        }
      },
    }),
    registerApiRoute('/web/workspace/file', {
      method: 'GET',
      requiresAuth: false,
      handler: async c => {
        const workspacePath = c.req.query('workspacePath');
        const path = c.req.query('path');
        if (!workspacePath) return c.json({ error: 'Missing required query param: workspacePath' }, 400);
        if (!path) return c.json({ error: 'Missing required query param: path' }, 400);
        try {
          const session = await resolveAuthorizedSession(loose(c), sessionFs, workspacePath);
          if (session && sessionFs) {
            return c.json(await readSessionWorkspaceFile(sessionFs.fleet, session, path));
          }
          return c.json(await readWorkspaceFile(root, workspacePath, path));
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          const status =
            message.includes('outside') ||
            message.includes('relative') ||
            message.includes('escapes') ||
            message.includes('not approved') ||
            message.includes('not available')
              ? 403
              : message.includes('directory')
                ? 400
                : message.includes('not found')
                  ? 404
                  : 500;
          return c.json({ error: message }, status);
        }
      },
    }),
    registerApiRoute('/web/codebase/resolve', {
      method: 'GET',
      requiresAuth: false,
      handler: async c => {
        const path = c.req.query('path');
        if (!path) return c.json({ error: 'Missing required query param: path' }, 400);
        // Confine resolution to the browsable root (following symlinks), so this
        // endpoint can't be used to probe arbitrary filesystem paths. The web UI
        // only ever resolves directories the user picked via the root-confined
        // browser, so legitimate requests are always within the root.
        const confined = await realPathWithinRoot(isAbsolute(path) ? resolve(path) : resolve(root, path), root);
        if (!confined) return c.json({ error: 'Path is outside the browsable root' }, 403);
        try {
          return c.json(resolveCodebase(confined));
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          return c.json({ error: message }, 500);
        }
      },
    }),
  ];
}
