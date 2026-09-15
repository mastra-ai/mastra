import { lstat, open, readdir, realpath, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { isAbsolute, join, posix as posixPath, resolve, sep } from 'node:path';

import { SandboxFilesystem } from '@mastra/code-sdk/agents/sandbox-filesystem';
import { detectProject, getResourceIdOverride } from '@mastra/code-sdk/utils/project';
import { registerApiRoute } from '@mastra/core/server';
import type { ApiRoute } from '@mastra/core/server';
import type { Context } from 'hono';

import { requireExec } from '../sandbox/materialization.js';
import type { ExecutableSandbox } from '../sandbox/materialization.js';
import { peekSessionSandbox } from '../sandbox/session-sandbox.js';
import { waitForPendingFilesystemCapture } from '../session/filesystem-capture.js';
import type { FilesystemStorage } from '../storage/domains/filesystem/base.js';
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

export interface WorkspaceFilesListing {
  /** The Factory session resource id. */
  workspacePath: string;
  /** The agent thread whose terminal file list was captured. */
  threadId: string;
  files: Array<{ path: string }>;
}

export type WorkspaceChangeStatus =
  | 'modified'
  | 'added'
  | 'deleted'
  | 'renamed'
  | 'copied'
  | 'untracked'
  | 'conflicted';

export interface WorkspaceChange {
  path: string;
  previousPath?: string;
  status: WorkspaceChangeStatus;
  additions?: number;
  deletions?: number;
  binary?: boolean;
}

export interface WorkspaceChanges {
  workspacePath: string;
  available: boolean;
  changes: WorkspaceChange[];
  additions?: number;
  deletions?: number;
}

export interface WorkspaceDiff {
  workspacePath: string;
  path: string;
  patch: string;
  truncated: boolean;
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
const MAX_DIFF_BYTES = 512 * 1024;
const WORKSPACE_NUMSTAT_SCRIPT = `
set -e
workdir=$1
index_file=$(mktemp)
untracked_file=$(mktemp)
object_dir=$(mktemp -d)
trap 'rm -f "$index_file" "$untracked_file"; rm -rf "$object_dir"' EXIT
rm -f "$index_file"
git -C "$workdir" diff --numstat -z --find-renames --no-ext-diff --no-textconv HEAD
git -C "$workdir" ls-files --others --exclude-standard -z >"$untracked_file"
git_dir=$(git -C "$workdir" rev-parse --absolute-git-dir)
export GIT_INDEX_FILE="$index_file"
export GIT_OBJECT_DIRECTORY="$object_dir"
export GIT_ALTERNATE_OBJECT_DIRECTORIES="$git_dir/objects"
git -C "$workdir" read-tree --empty
git -C "$workdir" update-index --add -z --stdin <"$untracked_file"
empty_tree=$(git -C "$workdir" hash-object -t tree /dev/null)
git -C "$workdir" diff --cached --numstat -z --no-ext-diff --no-textconv "$empty_tree"
`;
const BOUNDED_GIT_DIFF_SCRIPT = `
allow_exit_one=$1
shift
status_file=$(mktemp)
stderr_file=$(mktemp)
trap 'rm -f "$status_file" "$stderr_file"' EXIT
(
  git "$@" 2>"$stderr_file"
  printf '%s' "$?" >"$status_file"
) | head -c ${MAX_DIFF_BYTES + 1}
status=$(cat "$status_file")
case "$status" in
  0|141) exit 0 ;;
  1) [ "$allow_exit_one" = "1" ] && exit 0 ;;
esac
cat "$stderr_file" >&2
exit "\${status:-1}"
`;
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
  sessions: { getBySessionId(sessionId: string): Promise<SourceControlSession | null> };
  filesystem: Pick<FilesystemStorage, 'listFiles'>;
}

/**
 * Resolve a `workspacePath` query param as a Factory session id. Returns the
 * session when one exists and the caller owns it, `null` when no session
 * matches (the caller should fall back to local-path handling), and throws
 * when a session exists but belongs to another tenant.
 */
async function resolveAuthorizedSession(
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

export async function listSessionFilesystemFiles(
  filesystem: Pick<FilesystemStorage, 'listFiles'>,
  session: SourceControlSession,
  threadId: string,
): Promise<WorkspaceFilesListing> {
  const safeThreadId = threadId.trim();
  if (!safeThreadId) throw new Error('Missing required query param: threadId');

  // The turn-end capture no longer gates agent_end, so a reader refetching on
  // run completion could otherwise race it and serve the previous turn's
  // listing. Await the in-flight capture (bounded) before reading.
  await waitForPendingFilesystemCapture(session.sessionId);

  return {
    workspacePath: session.sessionId,
    threadId: safeThreadId,
    files: await filesystem.listFiles({ resourceId: session.sessionId, threadId: safeThreadId }),
  };
}

interface SessionSandboxHandle {
  sandbox: ExecutableSandbox;
  filesystem: SandboxFilesystem;
  workdir: string;
}

/**
 * Resolve the session's sandbox from the per-process memo and wrap its
 * workdir in a `SandboxFilesystem`. Returns `null` when the session has no
 * sandbox in this process (never opened here, or evicted by retirement).
 * This is a passive read path, so it never constructs or provisions: the
 * session's files come back the next time the workspace is actually opened
 * (e.g. by sending a message).
 */
async function sessionSandbox(session: SourceControlSession): Promise<SessionSandboxHandle | null> {
  const entry = peekSessionSandbox(session.id);
  // An unresolved workdir means the sandbox never started in this process —
  // nothing is materialized, so there are no files to browse.
  if (!entry?.workdir) return null;
  const sandbox = requireExec(entry.sandbox);
  return {
    sandbox,
    filesystem: new SandboxFilesystem({ sandbox, workdir: entry.workdir }),
    workdir: entry.workdir,
  };
}

/** List an approved rendered root inside a Factory session's sandbox workdir. */
export async function listSessionRenderedPath(
  session: SourceControlSession,
  renderedRoot: string,
): Promise<WorkspaceRenderedListing> {
  const safeRoot = assertApprovedRenderedRoot(renderedRoot);
  const handle = await sessionSandbox(session);
  const rootPath = posixPath.join(handle?.workdir ?? '', safeRoot);
  const empty: WorkspaceRenderedListing = { workspacePath: session.sessionId, root: safeRoot, rootPath, entries: [] };
  if (!handle) return empty;

  // One round trip: emit "type\tsize\tmtime\tpath" per entry. `safeRoot` comes
  // from a fixed allowlist so interpolating it (quoted) is safe.
  const quotedRoot = `'${rootPath.replace(/'/g, `'\\''`)}'`;
  const result = await handle.sandbox.executeCommand(
    'sh',
    [
      '-c',
      `test -d ${quotedRoot} && find ${quotedRoot} -mindepth 1 -printf '%y\\t%s\\t%T@\\t%p\\n' 2>/dev/null || true`,
    ],
    { timeout: 30_000 },
  );
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

/** Read a file inside a session's sandbox. Paths outside rendered roots require a persisted-file allowlist check in the route. */
export async function readSessionWorkspaceFile(
  session: SourceControlSession,
  path: string,
  options: { allowUnapprovedPath?: boolean } = {},
): Promise<WorkspaceFile> {
  const safePath = assertRelativePath(path, 'path');
  if (!options.allowUnapprovedPath) assertApprovedRenderedRoot(safePath.split('/')[0] ?? '');

  const handle = await sessionSandbox(session);
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

function changeStatus(code: string): WorkspaceChangeStatus {
  if (code === '??') return 'untracked';
  if (code.includes('U') || code === 'AA' || code === 'DD') return 'conflicted';
  if (code.includes('R')) return 'renamed';
  if (code.includes('C')) return 'copied';
  if (code.includes('D')) return 'deleted';
  if (code.includes('A')) return 'added';
  return 'modified';
}

export function parseWorkspaceChanges(output: string): WorkspaceChange[] {
  const records = output.split('\0');
  const changes: WorkspaceChange[] = [];

  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    if (!record || record.length < 4) continue;
    const code = record.slice(0, 2);
    const path = record.slice(3);
    const status = changeStatus(code);
    if (status === 'renamed' || status === 'copied') {
      const previousPath = records[index + 1];
      if (previousPath) index += 1;
      changes.push({ path, previousPath: previousPath || undefined, status });
      continue;
    }
    changes.push({ path, status });
  }

  return changes.toSorted((a, b) => a.path.localeCompare(b.path));
}

export function parseWorkspaceChangeStats(output: string) {
  const records = output.split('\0');
  const stats = new Map<string, { additions?: number; deletions?: number; binary?: boolean }>();

  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    if (!record) continue;
    const firstTab = record.indexOf('\t');
    const secondTab = record.indexOf('\t', firstTab + 1);
    if (firstTab < 0 || secondTab < 0) continue;

    const additionsText = record.slice(0, firstTab);
    const deletionsText = record.slice(firstTab + 1, secondTab);
    let path = record.slice(secondTab + 1);
    if (!path) {
      const renamedPath = records[index + 2];
      if (!renamedPath) continue;
      path = renamedPath;
      index += 2;
    }
    if (path.startsWith('./')) path = path.slice(2);

    if (additionsText === '-' || deletionsText === '-') {
      stats.set(path, { binary: true });
      continue;
    }

    const additions = Number(additionsText);
    const deletions = Number(deletionsText);
    if (Number.isFinite(additions) && Number.isFinite(deletions)) stats.set(path, { additions, deletions });
  }

  return stats;
}

function unavailableWorkspaceChanges(workspacePath: string): WorkspaceChanges {
  return { workspacePath, available: false, changes: [] };
}

export async function listSessionWorkspaceChanges(session: SourceControlSession): Promise<WorkspaceChanges> {
  const handle = await sessionSandbox(session);
  if (!handle) return unavailableWorkspaceChanges(session.sessionId);

  const [statusResult, statsResult] = await Promise.all([
    handle.sandbox.executeCommand(
      'git',
      ['-C', handle.workdir, 'status', '--porcelain=v1', '-z', '--untracked-files=all'],
      { timeout: 30_000 },
    ),
    handle.sandbox.executeCommand('sh', ['-c', WORKSPACE_NUMSTAT_SCRIPT, 'mastracode-numstat', handle.workdir], {
      timeout: 30_000,
    }),
  ]);
  if (statusResult.exitCode !== 0) return unavailableWorkspaceChanges(session.sessionId);

  const changes = parseWorkspaceChanges(statusResult.stdout);
  if (statsResult.exitCode !== 0) {
    return { workspacePath: session.sessionId, available: true, changes };
  }

  const stats = parseWorkspaceChangeStats(statsResult.stdout);
  let additions = 0;
  let deletions = 0;
  const changesWithStats = changes.map(change => {
    const changeStats = stats.get(change.path);
    additions += changeStats?.additions ?? 0;
    deletions += changeStats?.deletions ?? 0;
    return { ...change, ...changeStats };
  });

  return { workspacePath: session.sessionId, available: true, changes: changesWithStats, additions, deletions };
}

async function executeBoundedGitDiff(sandbox: ExecutableSandbox, args: string[], allowExitOne = false) {
  return sandbox.executeCommand(
    'sh',
    ['-c', BOUNDED_GIT_DIFF_SCRIPT, 'mastracode-diff', allowExitOne ? '1' : '0', ...args],
    { timeout: 30_000 },
  );
}

function truncatePatch(patchBuffer: Buffer): string {
  const patch = patchBuffer.subarray(0, MAX_DIFF_BYTES).toString('utf8');
  const lastNewline = patch.lastIndexOf('\n');
  if (lastNewline >= 0) return patch.slice(0, lastNewline + 1);
  return patch.replace(/\uFFFD+$/, '');
}

export async function readSessionWorkspaceDiff(
  session: SourceControlSession,
  path: string,
  previousPath?: string,
): Promise<WorkspaceDiff> {
  const safePath = assertRelativePath(path, 'path');
  const safePreviousPath = previousPath ? assertRelativePath(previousPath, 'previousPath') : undefined;
  const handle = await sessionSandbox(session);
  if (!handle) throw new Error('Session workspace is not available');

  const pathspecs = safePreviousPath ? [safePreviousPath, safePath] : [safePath];
  let result = await executeBoundedGitDiff(handle.sandbox, [
    '--literal-pathspecs',
    '-C',
    handle.workdir,
    'diff',
    '--find-renames',
    '--no-ext-diff',
    '--no-color',
    '--unified=3',
    'HEAD',
    '--',
    ...pathspecs,
  ]);
  if (result.exitCode !== 0) throw new Error(result.stderr || 'Unable to read workspace diff');

  if (!result.stdout) {
    const untracked = await handle.sandbox.executeCommand(
      'git',
      ['--literal-pathspecs', '-C', handle.workdir, 'ls-files', '--others', '--exclude-standard', '--', safePath],
      { timeout: 30_000 },
    );
    if (untracked.exitCode === 0 && untracked.stdout.trim()) {
      result = await executeBoundedGitDiff(
        handle.sandbox,
        [
          '-C',
          handle.workdir,
          'diff',
          '--no-index',
          '--no-ext-diff',
          '--no-color',
          '--unified=3',
          '--',
          '/dev/null',
          safePath,
        ],
        true,
      );
      if (result.exitCode !== 0 && result.exitCode !== 1) {
        throw new Error(result.stderr || 'Unable to read workspace diff');
      }
    }
  }

  const patchBuffer = Buffer.from(result.stdout);
  const truncated = patchBuffer.length > MAX_DIFF_BYTES;
  return {
    workspacePath: session.sessionId,
    path: safePath,
    patch: truncated ? truncatePatch(patchBuffer) : result.stdout,
    truncated,
  };
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
            return c.json(await listSessionRenderedPath(session, renderedRoot));
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
    registerApiRoute('/web/workspace/files', {
      method: 'GET',
      requiresAuth: false,
      handler: async c => {
        const workspacePath = c.req.query('workspacePath');
        const threadId = c.req.query('threadId')?.trim();
        if (!workspacePath) return c.json({ error: 'Missing required query param: workspacePath' }, 400);
        if (!threadId) return c.json({ error: 'Missing required query param: threadId' }, 400);
        try {
          const session = await resolveAuthorizedSession(loose(c), sessionFs, workspacePath);
          if (!session || !sessionFs) return c.json({ error: 'Session workspace is not available' }, 403);
          return c.json(await listSessionFilesystemFiles(sessionFs.filesystem, session, threadId));
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          const status = message.includes('not available') ? 403 : 500;
          return c.json({ error: message }, status);
        }
      },
    }),
    registerApiRoute('/web/workspace/changes', {
      method: 'GET',
      requiresAuth: false,
      handler: async c => {
        const workspacePath = c.req.query('workspacePath');
        if (!workspacePath) return c.json({ error: 'Missing required query param: workspacePath' }, 400);
        try {
          const session = await resolveAuthorizedSession(loose(c), sessionFs, workspacePath);
          if (!session || !sessionFs) return c.json(unavailableWorkspaceChanges(workspacePath));
          return c.json(await listSessionWorkspaceChanges(session));
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          return c.json({ error: message }, message.includes('not available') ? 403 : 500);
        }
      },
    }),
    registerApiRoute('/web/workspace/changes/diff', {
      method: 'GET',
      requiresAuth: false,
      handler: async c => {
        const workspacePath = c.req.query('workspacePath');
        const path = c.req.query('path');
        const previousPath = c.req.query('previousPath');
        if (!workspacePath) return c.json({ error: 'Missing required query param: workspacePath' }, 400);
        if (!path) return c.json({ error: 'Missing required query param: path' }, 400);
        try {
          const session = await resolveAuthorizedSession(loose(c), sessionFs, workspacePath);
          if (!session || !sessionFs) return c.json({ error: 'Session workspace is not available' }, 403);
          return c.json(await readSessionWorkspaceDiff(session, path, previousPath));
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          const status =
            message.includes('relative') || message.includes('escapes') || message.includes('not available')
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
        const requestedThreadId = c.req.query('threadId');
        const threadId = requestedThreadId?.trim();
        if (!workspacePath) return c.json({ error: 'Missing required query param: workspacePath' }, 400);
        if (!path) return c.json({ error: 'Missing required query param: path' }, 400);
        if (requestedThreadId !== undefined && !threadId) {
          return c.json({ error: 'Missing required query param: threadId' }, 400);
        }
        try {
          const session = await resolveAuthorizedSession(loose(c), sessionFs, workspacePath);
          if (session && sessionFs) {
            if (threadId) {
              const safePath = assertRelativePath(path, 'path');
              const listing = await listSessionFilesystemFiles(sessionFs.filesystem, session, threadId);
              if (!listing.files.some(file => file.path === safePath)) {
                return c.json({ error: 'Path is not available for this thread' }, 404);
              }
              return c.json(await readSessionWorkspaceFile(session, safePath, { allowUnapprovedPath: true }));
            }
            return c.json(await readSessionWorkspaceFile(session, path));
          }
          if (threadId) return c.json({ error: 'Session workspace is not available' }, 403);
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
