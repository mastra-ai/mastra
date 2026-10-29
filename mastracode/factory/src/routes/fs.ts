import { lstat, open, readdir, realpath, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { isAbsolute, join, posix as posixPath, resolve, sep } from 'node:path';

import { SETUP_MARKER_DIR } from '@internal/workspace';
import { SandboxFilesystem } from '@mastra/code-sdk/agents/sandbox-filesystem';
import { detectProject, getResourceIdOverride } from '@mastra/code-sdk/utils/project';
import { registerApiRoute } from '@mastra/core/server';
import type { ApiRoute } from '@mastra/core/server';
import type { Context } from 'hono';

import { requireExec } from '../sandbox/materialization.js';
import type { ExecutableSandbox } from '../sandbox/materialization.js';
import { peekSessionSandbox, sessionLayout } from '../sandbox/session-sandbox.js';
import type { SessionLayout, SessionLayoutRepository } from '../sandbox/session-sandbox.js';
import { peekSessionEnvironment } from '../session/environment-state-processor.js';
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

export interface WorkspaceTreeEntry {
  name: string;
  /** Path from the session's layout root, the form the file route takes. */
  path: string;
  type: 'file' | 'directory';
  size?: number;
  /** Set when the entry is a symlink: where it points, as written in the link. */
  symlinkTarget?: string;
  /** Set when the entry is a symlink: the tree path of what it resolves to. */
  linkedPath?: string;
}

/** One directory of a session's checkouts, read live from its sandbox. */
export interface WorkspaceTreeListing {
  workspacePath: string;
  /** The listed directory; empty for the top level. */
  path: string;
  /** False when this process holds no sandbox for the session, so nothing was read. */
  available: boolean;
  entries: WorkspaceTreeEntry[];
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

export interface WorkspaceChangesRepository {
  slug: string;
  /** The path prefix of this repository's changes in the flat list, e.g. `platform/`. */
  prefix: string;
  /** False when the checkout could not be inspected (missing, or git failed). */
  available: boolean;
  changes: WorkspaceChange[];
  additions?: number;
  deletions?: number;
}

export interface WorkspaceChanges {
  workspacePath: string;
  available: boolean;
  /** Every repository's changes, paths prefixed by the repository directory in a multi-repository session. */
  changes: WorkspaceChange[];
  additions?: number;
  deletions?: number;
  /**
   * One group per environment repository, in position order. Present only
   * when the session's environment holds two or more repositories.
   */
  repositories?: WorkspaceChangesRepository[];
}

export type WorkspaceChangesScope = 'branch' | 'uncommitted';

export type WorkspacePatchOmission = 'file-too-large' | 'total-too-large';

export interface WorkspaceChangePatches extends WorkspaceChanges {
  scope: WorkspaceChangesScope;
  /** Each change's unified diff, keyed by its `path` in `changes`. */
  patches: Record<string, string>;
  /** Why a change has no entry in `patches`; a change in neither map is one git could not diff. */
  omittedPatches: Record<string, WorkspacePatchOmission>;
  /** Git's first error line when it could not diff changed files, prefixed by the slug with several repositories. */
  diffError?: string;
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
const MAX_PATCH_SET_BYTES = 8 * 1024 * 1024;
/** Diffs the worktree against `$2`, untracked files as added through a throwaway index so the real one stays untouched. */
const WORKSPACE_DIFF_SCRIPT = `
set -e
workdir=$1
base=$2
shift 2
index_file=$(mktemp)
untracked_file=$(mktemp)
object_dir=$(mktemp -d)
trap 'rm -f "$index_file" "$untracked_file"; rm -rf "$object_dir"' EXIT
rm -f "$index_file"
git -C "$workdir" -c core.quotePath=false diff --no-ext-diff --no-textconv --find-renames "$@" "$base"
git -C "$workdir" ls-files --others --exclude-standard -z >"$untracked_file"
git_dir=$(git -C "$workdir" rev-parse --absolute-git-dir)
export GIT_INDEX_FILE="$index_file"
export GIT_OBJECT_DIRECTORY="$object_dir"
export GIT_ALTERNATE_OBJECT_DIRECTORIES="$git_dir/objects"
git -C "$workdir" read-tree --empty
git -C "$workdir" update-index --add -z --stdin <"$untracked_file"
empty_tree=$(git -C "$workdir" hash-object -t tree /dev/null)
git -C "$workdir" -c core.quotePath=false diff --cached --no-ext-diff --no-textconv "$@" "$empty_tree"
`;
const NUMSTAT_FORMAT = ['--numstat', '-z'];
const PATCH_FORMAT = ['--patch', '--no-color', '--unified=3', '--src-prefix=a/', '--dst-prefix=b/'];
/** Keeps the first `$1` bytes of the command in the remaining arguments; being cut short is not a failure. */
const BOUNDED_OUTPUT_SCRIPT = `
limit=$1
shift
status_file=$(mktemp)
trap 'rm -f "$status_file"' EXIT
(
  "$@"
  printf '%s' "$?" >"$status_file"
) | head -c "$limit"
status=$(cat "$status_file")
case "$status" in
  0|141) exit 0 ;;
esac
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
  // Names may start or end with spaces; only a blank path is missing.
  if (!path.trim()) throw new Error(`Missing required query param: ${label}`);
  if (isAbsolute(path)) throw new Error(`${label} must be relative`);
  if (path.split(/[\\/]+/).includes('..')) throw new Error(`${label} escapes workspace`);
  const normalized = resolve('/', path).slice(1);
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

interface SessionSandboxHandle {
  sandbox: ExecutableSandbox;
  filesystem: SandboxFilesystem;
  layout: SessionLayout;
  /** The branch each layout repository is compared against, by slug. */
  baseBranches: Map<string, string>;
}

/**
 * Resolve the session's sandbox from the per-process memo and wrap the
 * session layout's root in a `SandboxFilesystem`: the checkout for a
 * one-repository session, the workspace root (one directory per repository)
 * otherwise. Returns `null` when the session has no sandbox in this process
 * (never opened here, or evicted by retirement). This is a passive read path,
 * so it never constructs or provisions: the session's files come back the
 * next time the workspace is actually opened (e.g. by sending a message).
 */
async function sessionSandbox(session: SourceControlSession): Promise<SessionSandboxHandle | null> {
  const entry = peekSessionSandbox(session.id);
  // An unresolved workdir means the sandbox never started in this process —
  // nothing is materialized, so there are no files to browse.
  const layout = sessionLayout(entry);
  if (!entry || !layout) return null;
  const sandbox = requireExec(entry.sandbox);
  return {
    sandbox,
    // Session viewers read these files over HTTP, so a symlink must not lead
    // them outside the checkout.
    filesystem: new SandboxFilesystem({ sandbox, workdir: layout.root, verifySymlinks: true }),
    layout,
    baseBranches: repositoryBaseBranches(session, layout, entry.ownRepo),
  };
}

/**
 * The branch each layout repository is compared against: the session base
 * branch for the session's own repository (session branch vs base), the
 * default branch the boot recorded for every other one, `HEAD` (the checkout's
 * own `origin/HEAD`) until the boot has recorded it.
 */
function repositoryBaseBranches(
  session: SourceControlSession,
  layout: SessionLayout,
  ownRepo: string,
): Map<string, string> {
  const environment = layout.repos.length > 1 ? peekSessionEnvironment(session.sessionId) : undefined;
  const bases = new Map<string, string>();
  for (const repo of layout.repos) {
    if (layout.repos.length === 1 || repo.slug.toLowerCase() === ownRepo.toLowerCase()) {
      bases.set(repo.slug, session.baseBranch);
      continue;
    }
    const state = environment?.repositories.find(candidate => candidate.slug.toLowerCase() === repo.slug.toLowerCase());
    // The boot records the state at its end, after every setup command; until
    // then a secondary checkout compares against its own `origin/HEAD`.
    bases.set(repo.slug, state?.defaultBranch ?? 'HEAD');
  }
  return bases;
}

/** List an approved rendered root inside a Factory session's sandbox workdir. */
export async function listSessionRenderedPath(
  session: SourceControlSession,
  renderedRoot: string,
): Promise<WorkspaceRenderedListing> {
  const safeRoot = assertApprovedRenderedRoot(renderedRoot);
  const handle = await sessionSandbox(session);
  const rootPath = posixPath.join(handle?.layout.root ?? '', safeRoot);
  const empty: WorkspaceRenderedListing = { workspacePath: session.sessionId, root: safeRoot, rootPath, entries: [] };
  if (!handle) return empty;

  // One round trip: emit "type\tsize\tmtime\tpath" per entry. `safeRoot` comes
  // from a fixed allowlist so interpolating it (quoted) is safe. The listing is
  // parsed line by line, so retain all of it rather than the default 1 MiB tail.
  const quotedRoot = `'${rootPath.replace(/'/g, `'\\''`)}'`;
  const result = await handle.sandbox.executeCommand(
    'sh',
    [
      '-c',
      `test -d ${quotedRoot} && find ${quotedRoot} -mindepth 1 -printf '%y\\t%s\\t%T@\\t%p\\n' 2>/dev/null || true`,
    ],
    { timeout: 30_000, maxRetainedBytes: Infinity },
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

/**
 * Directory entries the file tree never shows or serves: git internals and the
 * sandbox's own setup markers.
 */
const HIDDEN_TREE_ENTRIES = new Set(['.git', SETUP_MARKER_DIR]);

/**
 * Where a tree path lives. Inside a checkout: that checkout and the path within
 * it (a bare repository directory resolves to its root). Elsewhere in the
 * working directory (a multi-repository session's root, `.artifacts`): no
 * checkout, so no ignore rules apply.
 */
function treeLocation(
  layout: SessionLayout,
  path: string,
): { repo: SessionLayoutRepository; relative: string } | { repo: undefined; relative: string } {
  const safePath = path ? assertRelativePath(path, 'path') : '';
  if (safePath.split('/').some(segment => HIDDEN_TREE_ENTRIES.has(segment))) {
    throw new Error('Path is not available in this session');
  }
  if (layout.repos.length === 1) return { repo: layout.repos[0]!, relative: safePath };
  const repo = layout.repos
    .filter(candidate => `${safePath}/`.startsWith(candidate.prefix))
    .toSorted((a, b) => b.prefix.length - a.prefix.length)[0];
  return repo ? { repo, relative: safePath.slice(repo.prefix.length) } : { repo: undefined, relative: safePath };
}

/**
 * The checkout-relative paths git ignores, in one `git check-ignore` call.
 * Ignored files (`.env`, build output, `node_modules`) are neither listed nor
 * served: viewers of a session shouldn't read its local secrets. Fails closed
 * when git can't answer.
 */
async function ignoredPaths(sandbox: ExecutableSandbox, repoDir: string, paths: string[]): Promise<Set<string>> {
  if (paths.length === 0) return new Set();
  // Paths go in as positional arguments, never into the script text, and back
  // NUL-separated so no filename needs quoting either way.
  const result = await sandbox.executeCommand(
    'sh',
    ['-c', 'cd "$1" && shift && printf \'%s\\0\' "$@" | git check-ignore -z --stdin', 'sh', repoDir, ...paths],
    { timeout: 30_000, maxRetainedBytes: Infinity },
  );
  // 0: some paths are ignored, 1: none are.
  if (result.exitCode === 1) return new Set();
  if (result.exitCode !== 0) throw new Error(`Unable to check ignored files: ${result.stderr.trim() || 'git failed'}`);
  return new Set(result.stdout.split('\0').filter(Boolean));
}

/**
 * The real absolute location of each path (relative to `root`), following
 * every symlink, or `''` when it doesn't exist; plus `root`'s own. Paths go in
 * as positional arguments and come back NUL-separated.
 */
async function realPaths(
  sandbox: ExecutableSandbox,
  root: string,
  paths: string[],
): Promise<{ root: string; paths: string[] }> {
  const result = await sandbox.executeCommand(
    'sh',
    [
      '-c',
      'cd "$1" && shift && printf \'%s\\0\' "$(pwd -P)" && for p; do printf \'%s\\0\' "$([ -e "$p" ] && readlink -f -- "$p")"; done',
      'sh',
      root,
      ...paths,
    ],
    { timeout: 30_000, maxRetainedBytes: Infinity },
  );
  if (result.exitCode !== 0) throw new Error(`Unable to resolve symlinks: ${result.stderr.trim() || 'failed'}`);
  const [physicalRoot = '', ...resolved] = result.stdout.split('\0');
  return { root: physicalRoot, paths: resolved.slice(0, paths.length) };
}

/** The first `bytes` bytes of a file, base64-encoded in the sandbox so binary content survives. */
async function readFilePrefix(sandbox: ExecutableSandbox, path: string, bytes: number): Promise<Buffer> {
  const result = await sandbox.executeCommand(
    'sh',
    // Not a pipe: sh reports only the last command's status, so a failed head
    // would read as an empty file.
    [
      '-c',
      't=$(mktemp) && trap \'rm -f "$t"\' EXIT && head -c "$1" -- "$2" >"$t" && base64 <"$t"',
      'sh',
      String(bytes),
      path,
    ],
    { timeout: 30_000, maxRetainedBytes: Infinity },
  );
  if (result.exitCode !== 0) throw new Error(`Unable to read file: ${result.stderr.trim() || 'failed'}`);
  return Buffer.from(result.stdout, 'base64');
}

/**
 * Where a real absolute path sits in the tree, or `undefined` when the tree
 * can't show it: missing, outside the working directory, or inside git
 * internals or setup markers.
 */
function treePathOf(layout: SessionLayout, physicalRoot: string, real: string): string | undefined {
  if (!real) return undefined;
  const relative = posixPath.relative(physicalRoot, real);
  if (relative === '..' || relative.startsWith('../') || posixPath.isAbsolute(relative)) return undefined;
  try {
    treeLocation(layout, relative);
  } catch {
    return undefined;
  }
  return relative;
}

/** Which tree paths their checkout ignores: one `git check-ignore` per checkout involved. */
async function ignoredTreePaths(
  sandbox: ExecutableSandbox,
  layout: SessionLayout,
  paths: string[],
): Promise<Set<string>> {
  const byRepo = new Map<SessionLayoutRepository, Map<string, string>>();
  for (const path of paths) {
    const { repo, relative } = treeLocation(layout, path);
    if (!repo || !relative) continue;
    const inRepo = byRepo.get(repo) ?? new Map<string, string>();
    inRepo.set(relative, path);
    byRepo.set(repo, inRepo);
  }
  const ignored = new Set<string>();
  for (const [repo, inRepo] of byRepo) {
    for (const relative of await ignoredPaths(sandbox, repo.dir, [...inRepo.keys()])) {
      ignored.add(inRepo.get(relative)!);
    }
  }
  return ignored;
}

/**
 * List one directory of a session's working directory from its sandbox,
 * without git internals or entries a checkout ignores. Passive like every
 * session read: a session with no sandbox in this process comes back
 * `available: false` instead of starting one.
 */
export async function listSessionWorkspaceTree(
  session: SourceControlSession,
  path = '',
): Promise<WorkspaceTreeListing> {
  const requested = path.trim() ? path : '';
  const handle = await sessionSandbox(session);
  const listing = { workspacePath: session.sessionId, path: requested };
  if (!handle) return { ...listing, available: false, entries: [] };

  const { layout, sandbox, filesystem } = handle;
  const location = treeLocation(layout, requested);
  const dir = (location.repo ? location.repo.prefix + location.relative : location.relative).replace(/\/$/, '');
  const children = (await filesystem.readdir(dir || '.')).filter(entry => !HIDDEN_TREE_ENTRIES.has(entry.name));
  const childPath = (name: string) => (dir ? `${dir}/${name}` : name);

  // A symlink is shown (not expanded) only when what it leads to could be
  // shown itself; it's judged by its target, since that is what a read serves.
  // The folder itself must be where its path says: the tree doesn't go
  // through symlinked folders.
  const links = children.filter(entry => entry.isSymlink);
  const resolve = [...(dir ? [dir] : []), ...links.map(entry => childPath(entry.name))];
  const real = resolve.length > 0 ? await realPaths(sandbox, layout.root, resolve) : undefined;
  const linkTargets = real ? real.paths.slice(dir ? 1 : 0) : [];
  if (dir && real!.paths[0] !== posixPath.join(real!.root, dir)) {
    throw new Error('Path is not available in this session');
  }
  const targets = new Map(links.map((entry, i) => [entry.name, treePathOf(layout, real!.root, linkTargets[i]!)]));
  const ignored = await ignoredTreePaths(sandbox, layout, [
    ...(dir ? [dir] : []),
    ...children.map(entry => childPath(entry.name)),
    ...[...targets.values()].filter((target): target is string => target !== undefined),
  ]);
  if (dir && ignored.has(dir)) throw new Error('Path is not available in this session');
  const visible = children.filter(entry => {
    if (ignored.has(childPath(entry.name))) return false;
    if (!entry.isSymlink) return true;
    const target = targets.get(entry.name);
    return target !== undefined && !ignored.has(target);
  });

  const entries = visible
    .map(
      (entry): WorkspaceTreeEntry => ({
        name: entry.name,
        path: childPath(entry.name),
        type: entry.type,
        ...(entry.type === 'file' && entry.size !== undefined && { size: entry.size }),
        ...(entry.isSymlink && {
          symlinkTarget: entry.symlinkTarget ?? targets.get(entry.name)!,
          linkedPath: targets.get(entry.name)!,
        }),
      }),
    )
    .toSorted((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'directory' ? -1 : 1));
  return { ...listing, available: true, entries };
}

/**
 * Read a file inside a session's sandbox: anything under an approved rendered
 * root, or anything the tree would list (not git internals, not ignored by its
 * checkout).
 */
export async function readSessionWorkspaceFile(session: SourceControlSession, path: string): Promise<WorkspaceFile> {
  const safePath = assertRelativePath(path, 'path');

  const handle = await sessionSandbox(session);
  if (!handle) throw new Error('Session workspace is not available');
  const { layout, sandbox } = handle;
  treeLocation(layout, safePath);
  // Judge the file by where it really is as well as by the path asked for: a
  // symlink to `.env` must not serve it. Rendered roots (plans, reports) are
  // served even when a checkout ignores them, but not through such a symlink.
  const parent = posixPath.dirname(safePath);
  const real = await realPaths(sandbox, layout.root, parent === '.' ? [safePath] : [safePath, parent]);
  const target = treePathOf(layout, real.root, real.paths[0]!);
  // The file itself may be a symlink, but not a folder on the way to it.
  const throughLink = parent !== '.' && real.paths[1] !== posixPath.join(real.root, parent);
  if (target === undefined || throughLink) throw new Error('Path is not available in this session');
  const trusted = APPROVED_RENDERED_ROOTS.has(safePath.split('/')[0] ?? '');
  const checked = [...new Set([...(trusted ? [] : [safePath]), ...(target === safePath ? [] : [target])])];
  if ((await ignoredTreePaths(sandbox, layout, checked)).size > 0) {
    throw new Error('Path is not available in this session');
  }
  const { filesystem } = handle;
  const info = await filesystem.stat(safePath);
  if (info.type === 'directory') throw new Error('Path is a directory');

  // Only the shown prefix of a large file leaves the sandbox.
  const truncated = info.size > MAX_TEXT_FILE_BYTES;
  const buffer = truncated
    ? await readFilePrefix(sandbox, real.paths[0]!, MAX_TEXT_FILE_BYTES)
    : ((await filesystem.readFile(safePath)) as Buffer);
  const base = {
    workspacePath: session.sessionId,
    path: safePath,
    name: posixPath.basename(safePath),
    size: info.size,
    updatedAt: info.modifiedAt.toISOString(),
  };
  try {
    const content = TEXT_DECODER.decode(buffer);
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
export function parseWorkspaceTrackedChanges(output: string): WorkspaceChange[] {
  const records = output.split('\0');
  const changes: WorkspaceChange[] = [];
  for (let index = 0; index < records.length;) {
    const code = records[index++];
    if (!code) continue;
    const status = changeStatus(code);
    if (status === 'renamed' || status === 'copied') {
      const previousPath = records[index++];
      const path = records[index++];
      if (path) changes.push({ path, previousPath: previousPath || undefined, status });
      continue;
    }
    const path = records[index++];
    if (path) changes.push({ path, status });
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

function isWorkspaceChangesScope(value: string): value is WorkspaceChangesScope {
  return value === 'branch' || value === 'uncommitted';
}

async function resolveSessionComparisonBase(
  sandbox: ExecutableSandbox,
  workdir: string,
  baseBranch: string,
  scope: WorkspaceChangesScope,
): Promise<string> {
  if (scope === 'uncommitted') return 'HEAD';
  const result = await sandbox.executeCommand('git', ['-C', workdir, 'merge-base', 'HEAD', `origin/${baseBranch}`], {
    timeout: 30_000,
  });
  const sha = result.stdout.trim();
  return result.exitCode === 0 && /^[0-9a-f]{40,64}$/i.test(sha) ? sha : 'HEAD';
}

type RepositoryChanges = Pick<WorkspaceChangesRepository, 'available' | 'changes' | 'additions' | 'deletions'>;

/** The changes of one checkout against its comparison base; `available: false` when git cannot inspect it. */
async function listRepositoryChanges(
  sandbox: ExecutableSandbox,
  workdir: string,
  comparisonBase: string,
): Promise<RepositoryChanges> {
  // These outputs are parsed record by record (-z) and per path, so retain all
  // of them rather than the default 1 MiB tail, which would drop or split entries.
  const [statusResult, trackedResult, statsResult] = await Promise.all([
    sandbox.executeCommand('git', ['-C', workdir, 'status', '--porcelain=v1', '-z', '--untracked-files=all'], {
      timeout: 30_000,
      maxRetainedBytes: Infinity,
    }),
    sandbox.executeCommand('git', ['-C', workdir, 'diff', '--name-status', '-z', '--find-renames', comparisonBase], {
      timeout: 30_000,
      maxRetainedBytes: Infinity,
    }),
    sandbox.executeCommand(
      'sh',
      ['-c', WORKSPACE_DIFF_SCRIPT, 'mastracode-numstat', workdir, comparisonBase, ...NUMSTAT_FORMAT],
      { timeout: 30_000, maxRetainedBytes: Infinity },
    ),
  ]);
  if (statusResult.exitCode !== 0) return { available: false, changes: [] };

  const statusChanges = parseWorkspaceChanges(statusResult.stdout);
  const trackedChanges = trackedResult.exitCode === 0 ? parseWorkspaceTrackedChanges(trackedResult.stdout) : [];
  const changesByPath = new Map(trackedChanges.map(change => [change.path, change]));
  for (const change of statusChanges) {
    if (trackedResult.exitCode !== 0 || change.status === 'untracked' || change.status === 'conflicted') {
      changesByPath.set(change.path, change);
    }
  }
  const changes = [...changesByPath.values()].toSorted((a, b) => a.path.localeCompare(b.path));
  if (statsResult.exitCode !== 0) return { available: true, changes };

  const stats = parseWorkspaceChangeStats(statsResult.stdout);
  let additions = 0;
  let deletions = 0;
  const changesWithStats = changes.map(change => {
    const changeStats = stats.get(change.path);
    additions += changeStats?.additions ?? 0;
    deletions += changeStats?.deletions ?? 0;
    return { ...change, ...changeStats };
  });
  return { available: true, changes: changesWithStats, additions, deletions };
}

function prefixChange(change: WorkspaceChange, prefix: string): WorkspaceChange {
  if (!prefix) return change;
  return {
    ...change,
    path: `${prefix}${change.path}`,
    ...(change.previousPath ? { previousPath: `${prefix}${change.previousPath}` } : {}),
  };
}

interface InspectedRepository {
  repo: SessionLayoutRepository;
  changes: RepositoryChanges;
}

function assembleWorkspaceChanges(workspacePath: string, inspected: InspectedRepository[]): WorkspaceChanges {
  // One repository: the response is exactly what it was before layouts.
  if (inspected.length === 1) {
    const { changes } = inspected[0]!;
    if (!changes.available) return unavailableWorkspaceChanges(workspacePath);
    return { workspacePath, ...changes };
  }

  // A failing checkout is unavailable on its own; the others still answer.
  const groups: WorkspaceChangesRepository[] = inspected.map(({ repo, changes }) => ({
    slug: repo.slug,
    prefix: repo.prefix,
    ...changes,
    changes: changes.changes.map(change => prefixChange(change, repo.prefix)),
  }));
  const available = groups.filter(group => group.available);
  const changes = available.flatMap(group => group.changes).toSorted((a, b) => a.path.localeCompare(b.path));
  const counted = available.filter(group => group.additions !== undefined);
  const totals =
    counted.length > 0
      ? {
          additions: counted.reduce((sum, group) => sum + (group.additions ?? 0), 0),
          deletions: counted.reduce((sum, group) => sum + (group.deletions ?? 0), 0),
        }
      : {};
  return {
    workspacePath,
    available: available.length > 0,
    changes,
    ...totals,
    repositories: groups,
  };
}

export async function listSessionWorkspaceChanges(session: SourceControlSession): Promise<WorkspaceChanges> {
  const handle = await sessionSandbox(session);
  if (!handle) return unavailableWorkspaceChanges(session.sessionId);
  const { sandbox, layout, baseBranches } = handle;

  const inspected = await Promise.all(
    layout.repos.map(async repo => {
      const comparisonBase = await resolveSessionComparisonBase(
        sandbox,
        repo.dir,
        baseBranches.get(repo.slug) ?? session.baseBranch,
        'branch',
      );
      return { repo, changes: await listRepositoryChanges(sandbox, repo.dir, comparisonBase) };
    }),
  );
  return assembleWorkspaceChanges(session.sessionId, inspected);
}

const GIT_C_ESCAPES: Record<string, string> = {
  '"': '\\"',
  '\\': '\\\\',
  '\x07': '\\a',
  '\b': '\\b',
  '\t': '\\t',
  '\n': '\\n',
  '\v': '\\v',
  '\f': '\\f',
  '\r': '\\r',
};

/** A path as git writes it in a diff header: `core.quotePath=false` quotes only for quotes, backslashes and control characters. */
function gitHeaderPath(path: string): string {
  let escaped = '';
  let quoted = false;
  for (const char of path) {
    const code = char.charCodeAt(0);
    const escape =
      GIT_C_ESCAPES[char] ?? (code < 0x20 || code === 0x7f ? `\\${code.toString(8).padStart(3, '0')}` : '');
    quoted ||= escape !== '';
    escaped += escape || char;
  }
  return quoted ? `"${escaped}"` : path;
}

interface KeyedPatches {
  patches: Map<string, string>;
  omitted: Map<string, WorkspacePatchOmission>;
}

function keyWorkspacePatches(patch: string, changes: readonly WorkspaceChange[]): KeyedPatches {
  const sections = patch.split(/^(?=diff --git )/m);
  const budgetSpent = Buffer.byteLength(patch) > MAX_PATCH_SET_BYTES;
  if (budgetSpent) sections.pop();

  const sectionsByHeader = new Map<string, string>();
  for (const section of sections) {
    const headerEnd = section.indexOf('\n');
    if (headerEnd >= 0) sectionsByHeader.set(section.slice(0, headerEnd), section);
  }

  const keyed: KeyedPatches = { patches: new Map(), omitted: new Map() };
  for (const change of changes) {
    const header = `diff --git ${gitHeaderPath(`a/${change.previousPath ?? change.path}`)} ${gitHeaderPath(`b/${change.path}`)}`;
    const section = sectionsByHeader.get(header);
    if (section === undefined) {
      if (budgetSpent) keyed.omitted.set(change.path, 'total-too-large');
    } else if (Buffer.byteLength(section) > MAX_DIFF_BYTES) {
      keyed.omitted.set(change.path, 'file-too-large');
    } else {
      keyed.patches.set(change.path, section);
    }
  }
  return keyed;
}

function prefixedEntries<T>(prefix: string, entries: Map<string, T>): [string, T][] {
  return Array.from(entries, ([path, value]): [string, T] => [`${prefix}${path}`, value]);
}

function unavailableWorkspacePatches(workspacePath: string, scope: WorkspaceChangesScope): WorkspaceChangePatches {
  return { ...unavailableWorkspaceChanges(workspacePath), scope, patches: {}, omittedPatches: {} };
}

export async function listSessionWorkspacePatches(
  session: SourceControlSession,
  scope: WorkspaceChangesScope,
): Promise<WorkspaceChangePatches> {
  const handle = await sessionSandbox(session);
  if (!handle) return unavailableWorkspacePatches(session.sessionId, scope);
  const { sandbox, layout, baseBranches } = handle;

  const inspected = await Promise.all(
    layout.repos.map(async repo => {
      const comparisonBase = await resolveSessionComparisonBase(
        sandbox,
        repo.dir,
        baseBranches.get(repo.slug) ?? session.baseBranch,
        scope,
      );
      const [changes, patch] = await Promise.all([
        listRepositoryChanges(sandbox, repo.dir, comparisonBase),
        sandbox.executeCommand(
          'sh',
          [
            '-c',
            BOUNDED_OUTPUT_SCRIPT,
            'mastracode-bounded',
            String(MAX_PATCH_SET_BYTES + 1),
            'sh',
            '-c',
            WORKSPACE_DIFF_SCRIPT,
            'mastracode-patch',
            repo.dir,
            comparisonBase,
            ...PATCH_FORMAT,
          ],
          { timeout: 30_000, maxRetainedBytes: Infinity },
        ),
      ]);
      if (patch.exitCode !== 0 && changes.changes.length > 0) {
        const diffError = patch.stderr.trim().split('\n')[0] || `git diff exited with code ${patch.exitCode}`;
        const keyed: KeyedPatches = { patches: new Map(), omitted: new Map() };
        return { repo, changes, keyed, diffError };
      }
      return { repo, changes, keyed: keyWorkspacePatches(patch.stdout, changes.changes), diffError: undefined };
    }),
  );
  const diffErrors = inspected.flatMap(({ repo, diffError }) => {
    if (!diffError) return [];
    return [layout.repos.length > 1 ? `${repo.slug}: ${diffError}` : diffError];
  });
  return {
    ...assembleWorkspaceChanges(session.sessionId, inspected),
    scope,
    patches: Object.fromEntries(inspected.flatMap(({ repo, keyed }) => prefixedEntries(repo.prefix, keyed.patches))),
    omittedPatches: Object.fromEntries(
      inspected.flatMap(({ repo, keyed }) => prefixedEntries(repo.prefix, keyed.omitted)),
    ),
    ...(diffErrors.length > 0 ? { diffError: diffErrors.join('\n') } : {}),
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
    registerApiRoute('/web/workspace/changes/patches', {
      method: 'GET',
      requiresAuth: false,
      handler: async c => {
        const workspacePath = c.req.query('workspacePath');
        const scope = c.req.query('scope') ?? 'branch';
        if (!workspacePath) return c.json({ error: 'Missing required query param: workspacePath' }, 400);
        if (!isWorkspaceChangesScope(scope)) return c.json({ error: 'scope must be branch or uncommitted' }, 400);
        try {
          const session = await resolveAuthorizedSession(loose(c), sessionFs, workspacePath);
          if (!session || !sessionFs) return c.json(unavailableWorkspacePatches(workspacePath, scope));
          return c.json(await listSessionWorkspacePatches(session, scope));
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          return c.json({ error: message }, message.includes('not available') ? 403 : 500);
        }
      },
    }),
    registerApiRoute('/web/workspace/tree', {
      method: 'GET',
      requiresAuth: false,
      handler: async c => {
        const workspacePath = c.req.query('workspacePath');
        if (!workspacePath) return c.json({ error: 'Missing required query param: workspacePath' }, 400);
        try {
          const session = await resolveAuthorizedSession(loose(c), sessionFs, workspacePath);
          if (!session || !sessionFs) return c.json({ error: 'Session workspace is not available' }, 403);
          return c.json(await listSessionWorkspaceTree(session, c.req.query('path') ?? ''));
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          const status =
            message.includes('relative') || message.includes('escapes') || message.includes('not available')
              ? 403
              : message.includes('not found')
                ? 404
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
          if (session && sessionFs) return c.json(await readSessionWorkspaceFile(session, path));
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
