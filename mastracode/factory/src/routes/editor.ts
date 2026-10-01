/**
 * Editor routes — full-workspace read/write for the factory-ui code editor.
 *
 * Unlike `fs.ts` (which limits rendered listings to the `.artifacts/*`
 * allow-list), these endpoints expose the session's entire sandbox workdir so
 * the browser editor can walk the checked-out repository. Confinement stays
 * strict: every path is resolved through `SandboxFilesystem`, which rejects
 * escapes past the workdir; every request must own the session.
 *
 *   - GET  /web/workspace/tree?workspacePath=&depth=            → paged tree
 *   - PUT  /web/workspace/file/write                            → save file
 *   - GET  /web/workspace/search?workspacePath=&q=              → grep contents
 *   - GET  /web/workspace/file/original?workspacePath=&path=    → git HEAD blob
 *   - POST /web/workspace/lsp                                   → hover / definitions
 *
 * The save endpoint writes through the sandbox filesystem so subsequent
 * `git status` calls (which back the diff gutter) see the edit immediately.
 */

import { realpathSync } from 'node:fs';
import { readFile as readHostFile, stat as statHostFile } from 'node:fs/promises';
import { posix as posixPath } from 'node:path';
import { fileURLToPath } from 'node:url';

import { SandboxFilesystem } from '@mastra/code-sdk/agents/sandbox-filesystem';
import { registerApiRoute } from '@mastra/core/server';
import type { ApiRoute } from '@mastra/core/server';
import { isLSPAvailable, LSPManager } from '@mastra/core/workspace';
import type { SandboxProcessManager, WorkspaceSandbox } from '@mastra/core/workspace';
import type { Context } from 'hono';

import { requireExec } from '../sandbox/materialization.js';
import type { ExecutableSandbox } from '../sandbox/materialization.js';
import { peekSessionSandbox } from '../sandbox/session-sandbox.js';
import type { SourceControlSession } from '../storage/domains/source-control/base.js';
import type { WorkspaceFile } from './fs.js';
import type { RouteAuth } from './route.js';

export interface EditorTreeEntry {
  name: string;
  /** Workspace-relative path with posix separators. */
  path: string;
  type: 'file' | 'directory';
  /** True for gitignored entries. Their contents are listed too (dimmed), except inside skip dirs like node_modules. */
  ignored?: boolean;
}

export interface EditorTreeListing {
  workspacePath: string;
  /** The directory relative to the workspace root that was listed (empty string is the root). */
  path: string;
  entries: EditorTreeEntry[];
  /** True when the walk hit MAX_TREE_ENTRIES and dropped entries. */
  truncated?: boolean;
}

export interface EditorSearchMatch {
  path: string;
  line: number;
  preview: string;
}

export interface EditorSearchResponse {
  workspacePath: string;
  query: string;
  matches: EditorSearchMatch[];
  truncated: boolean;
}

export interface EditorFileOriginal {
  workspacePath: string;
  path: string;
  /** False when the file is untracked/new at HEAD — diff against empty. */
  exists: boolean;
  content: string;
}

export type EditorLspQueryKind =
  | 'hover'
  | 'definition'
  | 'typeDefinition'
  | 'implementation'
  | 'references'
  | 'symbols'
  | 'diagnostics'
  | 'rename'
  | 'codeActions'
  | 'formatting';

export interface EditorLspLocation {
  /** Workspace-relative posix path when inside the workdir; absolute otherwise. */
  path: string;
  /** True when the location resolves outside the session workdir (e.g. node_modules, lib.dom.d.ts). */
  external: boolean;
  /** 1-indexed. */
  line: number;
  /** 1-indexed. */
  character: number;
}

export interface EditorLspDiagnostic {
  severity: 'error' | 'warning' | 'info' | 'hint';
  message: string;
  /** 1-indexed. */
  line: number;
  /** 1-indexed. */
  character: number;
  /** 1-indexed; the diagnostic range end. */
  endLine: number;
  /** 1-indexed. */
  endCharacter: number;
  /** The reporting tool, e.g. "ts" or "eslint". */
  source?: string;
}

/** A single text replacement; all positions 1-indexed. */
export interface EditorLspTextEdit {
  startLine: number;
  startCharacter: number;
  endLine: number;
  endCharacter: number;
  newText: string;
}

/** A quick fix / refactoring whose edits all target the queried file. */
export interface EditorLspCodeAction {
  title: string;
  kind?: string;
  edits: EditorLspTextEdit[];
}

export interface EditorLspRenameResult {
  /** Files touched by the rename. In-workdir files are edited on disk server-side. */
  files: { path: string; external?: boolean; edits: number; applied: boolean }[];
}

/** One node of the document's symbol tree; positions 1-indexed. */
export interface EditorLspSymbol {
  name: string;
  /** LSP SymbolKind mapped to a readable label, e.g. "function", "class". */
  kind: string;
  line: number;
  endLine: number;
  children?: EditorLspSymbol[];
}

export interface EditorLspResponse {
  workspacePath: string;
  /** False when no language server can run for this session/file (e.g. remote sandbox). */
  available: boolean;
  hover?: { value: string; kind: string };
  locations?: EditorLspLocation[];
  diagnostics?: EditorLspDiagnostic[];
  /** Document symbol tree (kind: symbols). */
  symbols?: EditorLspSymbol[];
  /** Whole-document formatting edits (kind: formatting). */
  edits?: EditorLspTextEdit[];
  /** Quick fixes at the queried position (kind: codeActions). */
  actions?: EditorLspCodeAction[];
  /** Files changed by a rename (kind: rename). */
  rename?: EditorLspRenameResult;
}

const MAX_TREE_ENTRIES = 50_000;
const MAX_SEARCH_MATCHES = 500;
const MAX_WRITE_BYTES = 5 * 1024 * 1024;
const MAX_ORIGINAL_BYTES = 5 * 1024 * 1024;
const MAX_READ_BYTES = 5 * 1024 * 1024;

/** Directories the tree skips outright — they explode the entry count with no editor value. */
const TREE_SKIP_DIRS = new Set(['.git', 'node_modules', '.turbo', 'dist', 'build', '.next', '.cache', '.docusaurus']);

export interface SessionSandboxHandle {
  sandbox: ExecutableSandbox;
  /** The un-narrowed sandbox, for provider/process-manager introspection. */
  raw: WorkspaceSandbox;
  filesystem: SandboxFilesystem;
  workdir: string;
}

export async function sessionSandbox(session: SourceControlSession): Promise<SessionSandboxHandle | null> {
  const entry = peekSessionSandbox(session.id);
  if (!entry?.workdir) return null;
  const sandbox = requireExec(entry.sandbox);
  return {
    sandbox,
    raw: entry.sandbox,
    filesystem: new SandboxFilesystem({ sandbox, workdir: entry.workdir }),
    workdir: entry.workdir,
  };
}

/** Erase a route handler's path-parameterized context to a plain `Context`. */
function loose(c: unknown): Context {
  return c as Context;
}

function assertRelativePath(path: string, label: string): string {
  const trimmed = (path ?? '').trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('/')) throw new Error(`${label} must be relative`);
  const parts = trimmed.split(/[\\/]+/);
  if (parts.includes('..')) throw new Error(`${label} escapes workspace`);
  if (parts.some(part => part === '')) throw new Error(`${label} is malformed`);
  return parts.join('/');
}

export interface EditorSessionDeps {
  auth: RouteAuth;
  sessions: { getBySessionId(sessionId: string): Promise<SourceControlSession | null> };
}

/**
 * Resolve a `workspacePath` (the session id) to a session the caller owns.
 * Mirrors `resolveAuthorizedSession` in `fs.ts` but scoped to the editor module.
 */
export async function resolveAuthorizedSession(
  c: Context,
  deps: EditorSessionDeps,
  workspacePath: string,
): Promise<SourceControlSession> {
  const session = await deps.sessions.getBySessionId(workspacePath);
  if (!session) throw new Error('Session workspace is not available');
  if (deps.auth.enabled()) {
    await deps.auth.ensureUser(c);
    const tenant = deps.auth.tenant(c);
    if (!tenant || tenant.orgId !== session.orgId || tenant.userId !== session.userId) {
      throw new Error('Session is not available to the current user');
    }
  }
  return session;
}

interface TreeWalk {
  /** Paths relative to the listed directory. */
  rels: { rel: string; type: 'file' | 'directory'; ignored?: boolean }[];
  truncated: boolean;
}

/** Cap on gitignored entries — they're decoration, not navigation, so keep them cheap. */
const MAX_IGNORED_ENTRIES = 4000;

/**
 * Fast path: `git ls-files` answers from the index in tens of milliseconds
 * and skips everything gitignored (node_modules, dist…) for free, where a
 * recursive `find` walks the whole tree through the sandbox shell. Returns
 * null outside a git checkout so the caller can fall back to `find`.
 * Directories are derived from file paths, so empty directories don't show —
 * an acceptable trade for the speedup (git doesn't track them anyway).
 */
async function walkTreeViaGit(handle: SessionSandboxHandle, target: string): Promise<TreeWalk | null> {
  const quoted = target.replace(/'/g, `'\\''`);
  const cap = MAX_TREE_ENTRIES + 1;
  // Three passes:
  //   1. tracked + untracked-not-ignored files (the navigable tree),
  //   2. `--directory` collapses fully-ignored dirs to `dir/` lines — we use it
  //      to learn WHICH dirs are fully ignored (for dimming), and it's the only
  //      line skip dirs like node_modules get (their contents stay hidden),
  //   3. individual ignored files OUTSIDE skip dirs, so the contents of normal
  //      ignored dirs (.husky/_, .env folders…) are browsable, dimmed.
  const skipPattern = [...TREE_SKIP_DIRS].map(dir => dir.replace(/\./g, '\\.')).join('|');
  const separator = '::editor-tree-ignored::';
  const script = `cd '${quoted}' || exit 1
git ls-files --cached --others --exclude-standard 2>/dev/null | head -n ${cap}
echo '${separator}'
git ls-files --others --ignored --exclude-standard --directory 2>/dev/null | head -n ${MAX_IGNORED_ENTRIES}
echo '${separator}'
git ls-files --others --ignored --exclude-standard 2>/dev/null | grep -Ev '(^|/)(${skipPattern})/' | head -n ${MAX_IGNORED_ENTRIES}`;
  const result = await handle.sandbox.executeCommand('sh', ['-c', script], { timeout: 15_000 });
  if (result.exitCode !== 0) return null;

  const tracked: string[] = [];
  const ignoredCollapsed: string[] = [];
  const ignoredFiles: string[] = [];
  const sections = [tracked, ignoredCollapsed, ignoredFiles];
  let sectionIndex = 0;
  for (const line of result.stdout.split('\n')) {
    if (!line) continue;
    if (line === separator) {
      sectionIndex = Math.min(sectionIndex + 1, sections.length - 1);
      continue;
    }
    sections[sectionIndex]!.push(line);
  }
  if (tracked.length === 0) return null; // Not a repo (or empty) — let find decide.

  const truncated = tracked.length > MAX_TREE_ENTRIES;
  const files = truncated ? tracked.slice(0, MAX_TREE_ENTRIES) : tracked;
  const dirs = new Set<string>();
  const rels: TreeWalk['rels'] = [];
  for (const rel of files) {
    const parts = rel.split('/');
    if (parts.some(part => TREE_SKIP_DIRS.has(part))) continue;
    for (let index = 1; index < parts.length; index++) {
      dirs.add(parts.slice(0, index).join('/'));
    }
    rels.push({ rel, type: 'file' });
  }
  // Fully-ignored dirs from the `--directory` pass. Includes skip dirs
  // themselves (node_modules shows dimmed with its contents hidden), excludes
  // anything nested inside a skip dir.
  const ignoredDirSet = new Set<string>();
  for (const line of ignoredCollapsed) {
    if (!line.endsWith('/')) continue; // Plain ignored files come from pass 3.
    const rel = line.slice(0, -1);
    if (!rel) continue;
    const parts = rel.split('/');
    if (parts.slice(0, -1).some(part => TREE_SKIP_DIRS.has(part))) continue;
    ignoredDirSet.add(rel);
    for (let index = 1; index <= parts.length; index++) {
      dirs.add(parts.slice(0, index).join('/'));
    }
  }
  // Ignored files (never inside skip dirs — the grep already excluded those).
  for (const rel of ignoredFiles) {
    const parts = rel.split('/');
    if (parts.some(part => TREE_SKIP_DIRS.has(part))) continue;
    for (let index = 1; index < parts.length; index++) {
      dirs.add(parts.slice(0, index).join('/'));
    }
    rels.push({ rel, type: 'file', ignored: true });
  }
  // A dir is dimmed when it (or an ancestor) is fully ignored. Every dir is
  // emitted exactly once from the set — duplicates crash Pierre's path store.
  const isIgnoredPath = (rel: string): boolean => {
    if (ignoredDirSet.has(rel)) return true;
    const parts = rel.split('/');
    for (let index = 1; index < parts.length; index++) {
      if (ignoredDirSet.has(parts.slice(0, index).join('/'))) return true;
    }
    return false;
  };
  for (const dir of dirs) {
    rels.push({ rel: dir, type: 'directory', ...(isIgnoredPath(dir) ? { ignored: true } : {}) });
  }
  return { rels, truncated };
}

/** Fallback: portable BSD+GNU `find` walk for non-git workdirs. */
async function walkTreeViaFind(handle: SessionSandboxHandle, target: string): Promise<TreeWalk> {
  const quoted = target.replace(/'/g, `'\\''`);
  const skipDirs = [...TREE_SKIP_DIRS].map(name => `-name '${name}'`).join(' -o ');
  const prune = `\\( -type d \\( ${skipDirs} \\) -prune \\)`;
  // Two portable find passes (BSD find has no -printf): directories first,
  // then a separator line, then files. The separator can't collide with a
  // path because paths in the output are always absolute (start with /).
  // Each pass is capped in-shell so a pathological workdir can't stream an
  // unbounded listing back; one extra line per pass signals truncation.
  const cap = MAX_TREE_ENTRIES + 1;
  const separator = '::editor-tree-files::';
  const script = `test -d '${quoted}' || exit 0
find '${quoted}' ${prune} -o -type d -print 2>/dev/null | head -n ${cap}
echo '${separator}'
find '${quoted}' ${prune} -o -type f -print 2>/dev/null | head -n ${cap}`;
  const result = await handle.sandbox.executeCommand('sh', ['-c', script], { timeout: 30_000 });
  if (result.exitCode !== 0) return { rels: [], truncated: false };

  const rels: TreeWalk['rels'] = [];
  const baseLen = target.length + 1;
  let section: 'directory' | 'file' = 'directory';
  let truncated = false;
  for (const line of result.stdout.split('\n')) {
    if (!line) continue;
    if (line === separator) {
      section = 'file';
      continue;
    }
    if (line === target) continue;
    if (!line.startsWith(`${target}/`)) continue;
    if (rels.length >= MAX_TREE_ENTRIES) {
      truncated = true;
      break;
    }
    rels.push({ rel: line.slice(baseLen), type: section });
  }
  return { rels, truncated };
}

/** One-shot recursive tree walk via the sandbox; skips heavy directories. */
export async function listEditorTree(session: SourceControlSession, relativePath: string): Promise<EditorTreeListing> {
  const safeRelative = assertRelativePath(relativePath, 'path');
  const handle = await sessionSandbox(session);
  const empty: EditorTreeListing = { workspacePath: session.sessionId, path: safeRelative, entries: [] };
  if (!handle) return empty;

  const target = safeRelative ? posixPath.join(handle.workdir, safeRelative) : handle.workdir;
  const walk = (await walkTreeViaGit(handle, target)) ?? (await walkTreeViaFind(handle, target));

  const entries: EditorTreeEntry[] = walk.rels.slice(0, MAX_TREE_ENTRIES).map(({ rel, type, ignored }) => ({
    name: posixPath.basename(rel),
    path: safeRelative ? posixPath.join(safeRelative, rel) : rel,
    type,
    ...(ignored ? { ignored: true } : {}),
  }));
  const truncated = walk.truncated || walk.rels.length > MAX_TREE_ENTRIES;
  entries.sort((a, b) => {
    // Directories before files, then lexical.
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
    return a.path.localeCompare(b.path);
  });

  return { workspacePath: session.sessionId, path: safeRelative, entries, truncated: truncated || undefined };
}

/**
 * Read any file inside the session's sandbox workdir for editing. Unlike
 * fs.ts's `readWorkspaceFile` (which serves rendered artifacts and enforces
 * the `.artifacts` allow-list), this reads the full checkout through the
 * session sandbox. Reuses the `WorkspaceFile` response shape so content
 * flows straight into the existing editor buffer plumbing.
 */
export async function readEditorFile(session: SourceControlSession, path: string): Promise<WorkspaceFile> {
  const safePath = assertRelativePath(path, 'path');
  if (!safePath) throw new Error('path is required');
  const handle = await sessionSandbox(session);
  if (!handle) throw new Error('Session workspace is not available');

  const info = await handle.filesystem.stat(safePath);
  const name = safePath.split('/').pop() ?? safePath;
  const base = {
    workspacePath: session.sessionId,
    path: safePath,
    name,
    size: info.size,
    updatedAt: info.modifiedAt.toISOString(),
  };
  if (info.type === 'directory') throw new Error('Path is a directory');
  if (info.size > MAX_READ_BYTES) return { ...base, contentType: 'unsupported' };

  const raw = await handle.filesystem.readFile(safePath);
  const buffer = typeof raw === 'string' ? Buffer.from(raw, 'utf8') : raw;
  // NUL byte ⇒ binary; the code editor only handles text.
  if (buffer.includes(0)) return { ...base, contentType: 'unsupported' };
  return { ...base, contentType: 'text', content: buffer.toString('utf8') };
}

/**
 * Dependency locations a go-to-definition result may land in. Library reads
 * are limited to these so the route can't be used as an arbitrary host-file
 * reader — LSP results outside the checkout only ever point at package
 * stores, runner caches, and toolchain stdlibs.
 */
const LIBRARY_PATH_MARKERS = [
  '/node_modules/',
  '/.pnpm/',
  '/_npx/',
  '/site-packages/',
  '/dist-packages/',
  '/.cargo/registry/',
  '/go/pkg/mod/',
  '/.rustup/toolchains/',
];

const LIBRARY_FILE_SUFFIXES = [
  '.ts',
  '.tsx',
  '.mts',
  '.cts',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
  '.py',
  '.pyi',
  '.rs',
  '.go',
  '.java',
  '.kt',
  '.rb',
  '.php',
  '.css',
  '.scss',
  '.less',
  '.md',
  '.txt',
];

/**
 * Read an external dependency file (an LSP result outside the checkout —
 * node_modules resolved through the npx cache, TypeScript's lib.*.d.ts,
 * Python site-packages…) so go-to-definition can open it read-only.
 *
 * Reads hit the host filesystem directly, so this is only offered where LSP
 * itself runs: local-provider sandboxes on the session owner's own machine.
 * Remote sessions never produce external locations because LSP reports
 * unavailable there.
 */
export async function readEditorLibraryFile(session: SourceControlSession, path: string): Promise<WorkspaceFile> {
  const handle = await sessionSandbox(session);
  if (!handle) throw new Error('Session workspace is not available');
  if (!sessionLspManager(handle)) throw new Error('Library files are not available for this workspace');

  const normalized = posixPath.normalize((path ?? '').trim());
  if (!posixPath.isAbsolute(normalized) || normalized.includes('\0')) {
    throw new Error('path must be an absolute library path');
  }
  const lower = normalized.toLowerCase();
  if (!LIBRARY_PATH_MARKERS.some(marker => lower.includes(marker))) {
    throw new Error('path is not a dependency location');
  }
  if (!LIBRARY_FILE_SUFFIXES.some(suffix => lower.endsWith(suffix))) {
    throw new Error('unsupported library file type');
  }

  const info = await statHostFile(normalized);
  if (info.isDirectory()) throw new Error('Path is a directory');
  const base = {
    workspacePath: session.sessionId,
    path: normalized,
    name: posixPath.basename(normalized),
    size: info.size,
    updatedAt: info.mtime.toISOString(),
  };
  if (info.size > MAX_READ_BYTES) return { ...base, contentType: 'unsupported' };
  const buffer = await readHostFile(normalized);
  if (buffer.includes(0)) return { ...base, contentType: 'unsupported' };
  return { ...base, contentType: 'text', content: buffer.toString('utf8') };
}

/** Write a file inside the session's sandbox workdir. Content is UTF-8 text. */
export async function writeEditorFile(
  session: SourceControlSession,
  path: string,
  content: string,
): Promise<{ workspacePath: string; path: string; size: number; updatedAt: string }> {
  const safePath = assertRelativePath(path, 'path');
  if (!safePath) throw new Error('path is required');
  if (Buffer.byteLength(content, 'utf8') > MAX_WRITE_BYTES) throw new Error('File too large to save');

  const handle = await sessionSandbox(session);
  if (!handle) throw new Error('Session workspace is not available');
  await handle.filesystem.writeFile(safePath, content);
  const info = await handle.filesystem.stat(safePath);
  return {
    workspacePath: session.sessionId,
    path: safePath,
    size: info.size,
    updatedAt: info.modifiedAt.toISOString(),
  };
}

/**
 * Content search over the workspace. Fast path is `git grep` — it reads from
 * the index in parallel and skips everything gitignored, where a recursive
 * `grep -RIn` walks every file (including build output the excludes miss).
 * Falls back to plain grep outside git checkouts; grep (not ripgrep) because
 * grep is guaranteed present on every sandbox image.
 */
export async function searchEditorContents(
  session: SourceControlSession,
  query: string,
  { path = '' }: { path?: string } = {},
): Promise<EditorSearchResponse> {
  const trimmed = query.trim();
  const safeRelative = assertRelativePath(path, 'path');
  const empty: EditorSearchResponse = {
    workspacePath: session.sessionId,
    query: trimmed,
    matches: [],
    truncated: false,
  };
  if (!trimmed) return empty;

  const handle = await sessionSandbox(session);
  if (!handle) return empty;

  const target = safeRelative ? posixPath.join(handle.workdir, safeRelative) : handle.workdir;
  const quotedTarget = target.replace(/'/g, `'\\''`);
  const excludes = [...TREE_SKIP_DIRS].map(name => `--exclude-dir='${name}'`).join(' ');
  // -I skip binary, -n line numbers, -F fixed string. Cap with head so a
  // broad query can't dump the whole tree back over the wire. The pipeline's
  // exit code is head's, so probe for a repo explicitly — outside one we exit
  // 9 to trigger the plain-grep fallback (empty git-grep output inside a repo
  // just means no matches).
  const escaped = trimmed.replace(/'/g, `'\\''`);
  const cap = MAX_SEARCH_MATCHES + 1;
  const gitScript = `cd '${quotedTarget}' || exit 9
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 9
git grep -InF --untracked -- '${escaped}' 2>/dev/null | head -n ${cap}`;
  let result = await handle.sandbox.executeCommand('sh', ['-c', gitScript], { timeout: 30_000 });
  if (result.exitCode !== 0 && result.exitCode !== 1) {
    const grepScript =
      `cd '${quotedTarget}' && ` + `grep -RInF ${excludes} -- '${escaped}' . 2>/dev/null | head -n ${cap} || true`;
    result = await handle.sandbox.executeCommand('sh', ['-c', grepScript], { timeout: 30_000 });
    if (result.exitCode !== 0 && result.exitCode !== 1) return empty;
  }

  const matches: EditorSearchMatch[] = [];
  const lines = result.stdout.split('\n');
  const truncated = lines.length > MAX_SEARCH_MATCHES;
  for (const raw of lines) {
    if (!raw) continue;
    if (matches.length >= MAX_SEARCH_MATCHES) break;
    // Format: ./path/to/file:LINE:preview
    const firstColon = raw.indexOf(':');
    if (firstColon < 0) continue;
    const secondColon = raw.indexOf(':', firstColon + 1);
    if (secondColon < 0) continue;
    let path = raw.slice(0, firstColon);
    const line = Number(raw.slice(firstColon + 1, secondColon));
    const preview = raw.slice(secondColon + 1);
    if (path.startsWith('./')) path = path.slice(2);
    if (safeRelative) path = posixPath.join(safeRelative, path);
    if (!Number.isFinite(line)) continue;
    matches.push({ path, line, preview: preview.slice(0, 400) });
  }

  return { workspacePath: session.sessionId, query: trimmed, matches, truncated };
}

/**
 * The git HEAD blob for a workspace file, backing the editor's inline diff
 * view (`@codemirror/merge` diffs the buffer against this original). Untracked
 * files return `exists: false` so the client diffs against an empty document.
 */
export async function readEditorFileOriginal(session: SourceControlSession, path: string): Promise<EditorFileOriginal> {
  const safePath = assertRelativePath(path, 'path');
  if (!safePath) throw new Error('path is required');

  const handle = await sessionSandbox(session);
  const missing: EditorFileOriginal = { workspacePath: session.sessionId, path: safePath, exists: false, content: '' };
  if (!handle) return missing;

  const workdir = handle.workdir.replace(/'/g, `'\\''`);
  const spec = `HEAD:${safePath}`.replace(/'/g, `'\\''`);
  const script = `cd '${workdir}' && git show '${spec}' 2>/dev/null | head -c ${MAX_ORIGINAL_BYTES}`;
  const result = await handle.sandbox.executeCommand('sh', ['-c', script], { timeout: 30_000 });
  // `git show` fails (via the pipe, exit code of head stays 0 but output is
  // empty) for untracked paths; distinguish "empty file at HEAD" from
  // "missing at HEAD" with an explicit existence probe.
  const probe = await handle.sandbox.executeCommand(
    'sh',
    ['-c', `cd '${workdir}' && git cat-file -e '${spec}' 2>/dev/null && echo yes || echo no`],
    { timeout: 30_000 },
  );
  const exists = probe.stdout.trim() === 'yes';
  if (!exists) return missing;
  return { workspacePath: session.sessionId, path: safePath, exists: true, content: result.stdout };
}

/**
 * One LSP manager per session workdir. Language servers only run when the
 * session's sandbox is the local provider — then the workdir is a host path
 * and the host can spawn language servers directly against the same files
 * the sandbox owns. Remote VM sessions report `available: false`.
 */
const lspManagers = new Map<string, LSPManager>();

function sessionLspManager(handle: SessionSandboxHandle): LSPManager | null {
  const raw = handle.raw as WorkspaceSandbox & { provider?: string; processes?: SandboxProcessManager };
  if (raw.provider !== 'local' || !raw.processes || !isLSPAvailable()) return null;
  const existing = lspManagers.get(handle.workdir);
  if (existing) return existing;
  const manager = new LSPManager(raw.processes, handle.workdir, {
    maxOpenClients: 2,
    // `npx` fallback lets hover/definition work even when the checked-out repo
    // doesn't ship typescript-language-server; first hit is slow, then cached.
    packageRunner: 'npx',
  });
  lspManagers.set(handle.workdir, manager);
  return manager;
}

interface LspRawDiagnostic {
  severity?: number;
  message?: string;
  source?: string;
  range?: {
    start?: { line?: number; character?: number };
    end?: { line?: number; character?: number };
  };
}

/** LSP DiagnosticSeverity: 1=Error, 2=Warning, 3=Information, 4=Hint. */
function normalizeDiagnostic(raw: LspRawDiagnostic): EditorLspDiagnostic {
  const severity = raw.severity === 2 ? 'warning' : raw.severity === 3 ? 'info' : raw.severity === 4 ? 'hint' : 'error';
  const startLine = (raw.range?.start?.line ?? 0) + 1;
  const startCharacter = (raw.range?.start?.character ?? 0) + 1;
  return {
    severity,
    message: String(raw.message ?? ''),
    line: startLine,
    character: startCharacter,
    endLine: (raw.range?.end?.line ?? raw.range?.start?.line ?? 0) + 1,
    endCharacter: (raw.range?.end?.character ?? raw.range?.start?.character ?? 0) + 1,
    ...(typeof raw.source === 'string' ? { source: raw.source } : {}),
  };
}

/** LSP SymbolKind (1–26) to a readable label. */
const SYMBOL_KIND_LABELS: Record<number, string> = {
  1: 'file',
  2: 'module',
  3: 'namespace',
  4: 'package',
  5: 'class',
  6: 'method',
  7: 'property',
  8: 'field',
  9: 'constructor',
  10: 'enum',
  11: 'interface',
  12: 'function',
  13: 'variable',
  14: 'constant',
  15: 'string',
  16: 'number',
  17: 'boolean',
  18: 'array',
  19: 'object',
  20: 'key',
  21: 'null',
  22: 'enum member',
  23: 'struct',
  24: 'event',
  25: 'operator',
  26: 'type parameter',
};

interface LspRawSymbol {
  name?: string;
  kind?: number;
  /** Hierarchical DocumentSymbol shape. */
  range?: { start?: { line?: number }; end?: { line?: number } };
  children?: LspRawSymbol[];
  /** Flat SymbolInformation shape. */
  location?: { range?: { start?: { line?: number }; end?: { line?: number } } };
}

/** Handles both DocumentSymbol (hierarchical) and SymbolInformation (flat). */
function normalizeSymbol(raw: LspRawSymbol): EditorLspSymbol | null {
  if (!raw?.name) return null;
  const range = raw.range ?? raw.location?.range;
  if (!range?.start) return null;
  const children = (raw.children ?? [])
    .map(normalizeSymbol)
    .filter((child): child is EditorLspSymbol => child !== null);
  return {
    name: raw.name,
    kind: SYMBOL_KIND_LABELS[raw.kind ?? 0] ?? 'symbol',
    line: (range.start.line ?? 0) + 1,
    endLine: (range.end?.line ?? range.start.line ?? 0) + 1,
    ...(children.length ? { children } : {}),
  };
}

function normalizeHover(result: unknown): { value: string; kind: string } | undefined {
  const contents = (result as { contents?: unknown } | null)?.contents;
  if (!contents) return undefined;
  if (typeof contents === 'string') return { value: contents, kind: 'plaintext' };
  if (Array.isArray(contents)) {
    const first = contents[0];
    if (typeof first === 'string') return { value: first, kind: 'plaintext' };
    if (first?.value) return { value: first.value, kind: first.kind ?? 'markdown' };
    return undefined;
  }
  const markup = contents as { value?: string; kind?: string };
  return markup.value ? { value: markup.value, kind: markup.kind ?? 'markdown' } : undefined;
}

/** The workdir plus its realpath (when they differ) for prefix matching. */
function workdirRoots(workdir: string): string[] {
  try {
    const real = realpathSync(workdir);
    return real !== workdir ? [workdir, real] : [workdir];
  } catch {
    return [workdir];
  }
}

/**
 * Resolve a `file://` URI to a workspace-relative path when it lands inside
 * the workdir, or an absolute (external) path otherwise. Language servers
 * report resolved (realpath'd) locations, so a result inside the checkout can
 * still carry a foreign-looking prefix — macOS `/private/var` vs `/var`,
 * pnpm's symlinked virtual store, git worktrees. Compare against both the
 * configured workdir and its realpath, resolving the reported path when a
 * direct prefix match fails.
 */
function resolveUriPath(uri: string, roots: string[]): { path: string; external: boolean } | null {
  let fsPath: string;
  try {
    fsPath = fileURLToPath(uri);
  } catch {
    return null;
  }
  let resolved = fsPath;
  let root = roots.find(candidate => resolved.startsWith(`${candidate}/`));
  if (!root) {
    try {
      resolved = realpathSync(fsPath);
      root = roots.find(candidate => resolved.startsWith(`${candidate}/`));
    } catch {
      // Keep the reported path; it stays external.
    }
  }
  return { path: root ? resolved.slice(root.length + 1) : resolved, external: !root };
}

function normalizeLocation(entry: unknown, roots: string[]): EditorLspLocation | null {
  const record = entry as {
    uri?: string;
    targetUri?: string;
    range?: { start?: { line: number; character: number } };
    targetSelectionRange?: { start?: { line: number; character: number } };
    targetRange?: { start?: { line: number; character: number } };
  };
  const uri = record.uri ?? record.targetUri;
  const range = record.range ?? record.targetSelectionRange ?? record.targetRange;
  if (!uri || !range?.start) return null;
  const resolved = resolveUriPath(uri, roots);
  if (!resolved) return null;
  return {
    ...resolved,
    line: range.start.line + 1,
    character: range.start.character + 1,
  };
}

interface LspRawTextEdit {
  range?: { start?: { line?: number; character?: number }; end?: { line?: number; character?: number } };
  newText?: string;
}

function normalizeTextEdit(raw: LspRawTextEdit): EditorLspTextEdit {
  return {
    startLine: (raw.range?.start?.line ?? 0) + 1,
    startCharacter: (raw.range?.start?.character ?? 0) + 1,
    endLine: (raw.range?.end?.line ?? raw.range?.start?.line ?? 0) + 1,
    endCharacter: (raw.range?.end?.character ?? raw.range?.start?.character ?? 0) + 1,
    newText: String(raw.newText ?? ''),
  };
}

/** Flatten a WorkspaceEdit's `changes` / `documentChanges` into per-URI edit lists. */
function workspaceEditEntries(edit: unknown): { uri: string; edits: LspRawTextEdit[] }[] {
  const record = edit as {
    changes?: Record<string, LspRawTextEdit[]>;
    documentChanges?: { textDocument?: { uri?: string }; edits?: LspRawTextEdit[] }[];
  } | null;
  if (!record) return [];
  const entries: { uri: string; edits: LspRawTextEdit[] }[] = [];
  if (record.changes) {
    for (const [uri, edits] of Object.entries(record.changes)) {
      if (Array.isArray(edits)) entries.push({ uri, edits });
    }
  }
  if (Array.isArray(record.documentChanges)) {
    // File create/rename/delete operations are skipped — symbol renames only
    // produce text edits.
    for (const change of record.documentChanges) {
      if (change?.textDocument?.uri && Array.isArray(change.edits)) {
        entries.push({ uri: change.textDocument.uri, edits: change.edits });
      }
    }
  }
  return entries;
}

/** Apply LSP text edits (0-indexed ranges) to a document string. */
function applyTextEdits(content: string, edits: LspRawTextEdit[]): string {
  const lineStarts: number[] = [0];
  for (let index = 0; index < content.length; index++) {
    if (content[index] === '\n') lineStarts.push(index + 1);
  }
  const offsetAt = (line: number, character: number): number => {
    if (line >= lineStarts.length) return content.length;
    const lineStart = lineStarts[line]!;
    const lineEnd = line + 1 < lineStarts.length ? lineStarts[line + 1]! - 1 : content.length;
    return Math.min(lineStart + Math.max(0, character), lineEnd);
  };
  // Apply back-to-front so earlier offsets stay valid.
  const resolved = edits
    .map(edit => ({
      from: offsetAt(edit.range?.start?.line ?? 0, edit.range?.start?.character ?? 0),
      to: offsetAt(
        edit.range?.end?.line ?? edit.range?.start?.line ?? 0,
        edit.range?.end?.character ?? edit.range?.start?.character ?? 0,
      ),
      newText: String(edit.newText ?? ''),
    }))
    .sort((a, b) => b.from - a.from || b.to - a.to);
  let next = content;
  for (const edit of resolved) {
    next = next.slice(0, edit.from) + edit.newText + next.slice(Math.max(edit.to, edit.from));
  }
  return next;
}

/**
 * Hover / go-to queries for the editor. `content` (the unsaved buffer) is
 * pushed to the language server first so results reflect what the user sees,
 * not what's on disk.
 */
export async function queryEditorLsp(
  session: SourceControlSession,
  input: {
    path: string;
    line: number;
    character: number;
    kind: EditorLspQueryKind;
    content?: string;
    newName?: string;
  },
): Promise<EditorLspResponse> {
  const safePath = assertRelativePath(input.path, 'path');
  if (!safePath) throw new Error('path is required');
  const unavailable: EditorLspResponse = { workspacePath: session.sessionId, available: false };

  const handle = await sessionSandbox(session);
  if (!handle) return unavailable;
  const manager = sessionLspManager(handle);
  if (!manager) return unavailable;

  const absPath = posixPath.join(handle.workdir, safePath);
  let prepared;
  try {
    prepared = await manager.prepareQuery(absPath);
  } catch {
    return unavailable;
  }
  if (!prepared) return unavailable;

  const { client, uri, release } = prepared;
  try {
    if (typeof input.content === 'string') {
      client.notifyChange(absPath, input.content, Math.floor(Date.now() / 1000));
    }
    if (input.kind === 'diagnostics') {
      // The didChange above (or the disk content from prepareQuery's didOpen)
      // triggers a publishDiagnostics push; wait for it and forward the full
      // ranges so the editor can draw precise squiggles.
      const raw = await client.waitForDiagnostics(absPath, 5000).catch(() => [] as unknown[]);
      const diagnostics = (raw as LspRawDiagnostic[]).map(normalizeDiagnostic);
      return { workspacePath: session.sessionId, available: true, diagnostics };
    }
    const position = { line: input.line - 1, character: input.character - 1 };
    const roots = workdirRoots(handle.workdir);
    if (input.kind === 'hover') {
      const hover = normalizeHover(await client.queryHover(uri, position).catch(() => null));
      return { workspacePath: session.sessionId, available: true, ...(hover ? { hover } : {}) };
    }
    if (input.kind === 'references') {
      const raw = await client.queryReferences(uri, position).catch(() => [] as unknown[]);
      const locations = raw
        .map(entry => normalizeLocation(entry, roots))
        .filter((location): location is EditorLspLocation => location !== null);
      return { workspacePath: session.sessionId, available: true, locations };
    }
    if (input.kind === 'symbols') {
      const raw = await client.queryDocumentSymbols(uri).catch(() => [] as unknown[]);
      const symbols = (raw as LspRawSymbol[])
        .map(normalizeSymbol)
        .filter((symbol): symbol is EditorLspSymbol => symbol !== null);
      return { workspacePath: session.sessionId, available: true, symbols };
    }
    if (input.kind === 'formatting') {
      const raw = await client.queryFormatting(uri, { tabSize: 2, insertSpaces: true }).catch(() => []);
      return {
        workspacePath: session.sessionId,
        available: true,
        edits: (raw as LspRawTextEdit[]).map(normalizeTextEdit),
      };
    }
    if (input.kind === 'codeActions') {
      // Raw diagnostics (with server codes intact) give the server the context
      // to compute quick fixes at this position.
      const rawDiagnostics = (await client.waitForDiagnostics(absPath, 3000).catch(() => [])) as (LspRawDiagnostic & {
        [key: string]: unknown;
      })[];
      const overlapping = rawDiagnostics.filter(diagnostic => {
        const start = diagnostic.range?.start?.line ?? 0;
        const end = diagnostic.range?.end?.line ?? start;
        return start <= position.line && position.line <= end;
      });
      const range = overlapping[0]?.range ?? { start: position, end: position };
      const raw = await client
        .queryCodeActions(uri, range as never, { diagnostics: overlapping })
        .catch(() => [] as unknown[]);
      const actions: EditorLspCodeAction[] = [];
      for (const entry of raw as { title?: string; kind?: string; edit?: unknown; command?: unknown }[]) {
        // v1: only actions whose edits all target this file — they can be
        // applied directly in the client buffer. Command-only actions need
        // workspace/executeCommand and are skipped.
        if (!entry?.title || !entry.edit) continue;
        const entries = workspaceEditEntries(entry.edit);
        if (entries.length === 0) continue;
        const allLocal = entries.every(item => {
          const resolved = resolveUriPath(item.uri, roots);
          return resolved !== null && !resolved.external && resolved.path === safePath;
        });
        if (!allLocal) continue;
        actions.push({
          title: entry.title,
          ...(typeof entry.kind === 'string' ? { kind: entry.kind } : {}),
          edits: entries.flatMap(item => item.edits).map(normalizeTextEdit),
        });
      }
      return { workspacePath: session.sessionId, available: true, actions };
    }
    if (input.kind === 'rename') {
      const newName = input.newName?.trim();
      if (!newName) throw new Error('newName is required');
      const workspaceEdit = await client.queryRename(uri, position, newName).catch(() => null);
      const files: EditorLspRenameResult['files'] = [];
      // Edits for the file the rename was requested from, echoed back so the
      // client can update its open buffer in place instead of refetching.
      let queriedFileEdits: EditorLspTextEdit[] | undefined;
      for (const entry of workspaceEditEntries(workspaceEdit)) {
        const resolved = resolveUriPath(entry.uri, roots);
        if (!resolved) continue;
        if (resolved.external) {
          files.push({ path: resolved.path, external: true, edits: entry.edits.length, applied: false });
          continue;
        }
        // The client requires clean buffers before renaming, so disk content
        // matches what the language server computed edits against.
        const current = await handle.filesystem.readFile(resolved.path);
        const text = typeof current === 'string' ? current : current.toString('utf8');
        await handle.filesystem.writeFile(resolved.path, applyTextEdits(text, entry.edits));
        files.push({ path: resolved.path, edits: entry.edits.length, applied: true });
        if (resolved.path === input.path) {
          queriedFileEdits = entry.edits.map(normalizeTextEdit);
        }
      }
      return {
        workspacePath: session.sessionId,
        available: true,
        rename: { files },
        ...(queriedFileEdits ? { edits: queriedFileEdits } : {}),
      };
    }
    const raw =
      input.kind === 'definition'
        ? await client.queryDefinition(uri, position).catch(() => [])
        : input.kind === 'typeDefinition'
          ? await client.queryTypeDefinition(uri, position).catch(() => [])
          : await client.queryImplementation(uri, position).catch(() => []);
    const locations = raw
      .map(entry => normalizeLocation(entry, roots))
      .filter((location): location is EditorLspLocation => location !== null);
    return { workspacePath: session.sessionId, available: true, locations };
  } finally {
    client.notifyClose(absPath);
    release();
  }
}

/** Register `/web/workspace/tree`, `/web/workspace/file/{read,library,write,original}`, `/web/workspace/search`, `/web/workspace/lsp`. */
export function buildEditorRoutes(deps: EditorSessionDeps): ApiRoute[] {
  return [
    registerApiRoute('/web/workspace/file/read', {
      method: 'GET',
      requiresAuth: false,
      handler: async c => {
        const workspacePath = c.req.query('workspacePath');
        const path = c.req.query('path');
        if (!workspacePath) return c.json({ error: 'Missing required query param: workspacePath' }, 400);
        if (!path) return c.json({ error: 'Missing required query param: path' }, 400);
        try {
          const session = await resolveAuthorizedSession(loose(c), deps, workspacePath);
          return c.json(await readEditorFile(session, path));
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          const status =
            message.includes('not available') || message.includes('current user')
              ? 403
              : message.includes('escapes') || message.includes('relative') || message.includes('directory')
                ? 400
                : 500;
          return c.json({ error: message }, status);
        }
      },
    }),
    registerApiRoute('/web/workspace/file/library', {
      method: 'GET',
      requiresAuth: false,
      handler: async c => {
        const workspacePath = c.req.query('workspacePath');
        const path = c.req.query('path');
        if (!workspacePath) return c.json({ error: 'Missing required query param: workspacePath' }, 400);
        if (!path) return c.json({ error: 'Missing required query param: path' }, 400);
        try {
          const session = await resolveAuthorizedSession(loose(c), deps, workspacePath);
          return c.json(await readEditorLibraryFile(session, path));
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          const status =
            message.includes('not available') || message.includes('current user')
              ? 403
              : message.includes('absolute') ||
                  message.includes('dependency') ||
                  message.includes('unsupported') ||
                  message.includes('directory')
                ? 400
                : 500;
          return c.json({ error: message }, status);
        }
      },
    }),
    registerApiRoute('/web/workspace/tree', {
      method: 'GET',
      requiresAuth: false,
      handler: async c => {
        const workspacePath = c.req.query('workspacePath');
        const path = c.req.query('path') ?? '';
        if (!workspacePath) return c.json({ error: 'Missing required query param: workspacePath' }, 400);
        try {
          const session = await resolveAuthorizedSession(loose(c), deps, workspacePath);
          return c.json(await listEditorTree(session, path));
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          const status =
            message.includes('not available') || message.includes('current user')
              ? 403
              : message.includes('escapes') || message.includes('relative') || message.includes('malformed')
                ? 400
                : 500;
          return c.json({ error: message }, status);
        }
      },
    }),
    registerApiRoute('/web/workspace/file/write', {
      method: 'PUT',
      requiresAuth: false,
      handler: async c => {
        const workspacePath = c.req.query('workspacePath');
        if (!workspacePath) return c.json({ error: 'Missing required query param: workspacePath' }, 400);
        let body: { path?: string; content?: string };
        try {
          body = (await c.req.json()) as { path?: string; content?: string };
        } catch {
          return c.json({ error: 'Invalid JSON body' }, 400);
        }
        const path = body.path;
        const content = body.content;
        if (!path) return c.json({ error: 'Missing required body field: path' }, 400);
        if (typeof content !== 'string') return c.json({ error: 'Missing required body field: content' }, 400);
        try {
          const session = await resolveAuthorizedSession(loose(c), deps, workspacePath);
          return c.json(await writeEditorFile(session, path, content));
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          const status =
            message.includes('not available') || message.includes('current user')
              ? 403
              : message.includes('escapes') || message.includes('relative') || message.includes('too large')
                ? 400
                : 500;
          return c.json({ error: message }, status);
        }
      },
    }),
    registerApiRoute('/web/workspace/lsp', {
      method: 'POST',
      requiresAuth: false,
      handler: async c => {
        const workspacePath = c.req.query('workspacePath');
        if (!workspacePath) return c.json({ error: 'Missing required query param: workspacePath' }, 400);
        let body: {
          path?: string;
          line?: number;
          character?: number;
          kind?: string;
          content?: string;
          newName?: string;
        };
        try {
          body = (await c.req.json()) as typeof body;
        } catch {
          return c.json({ error: 'Invalid JSON body' }, 400);
        }
        const kinds: EditorLspQueryKind[] = [
          'hover',
          'definition',
          'typeDefinition',
          'implementation',
          'references',
          'symbols',
          'diagnostics',
          'rename',
          'codeActions',
          'formatting',
        ];
        const kind = kinds.find(candidate => candidate === body.kind);
        if (!body.path) return c.json({ error: 'Missing required body field: path' }, 400);
        if (!kind) return c.json({ error: `kind must be one of: ${kinds.join(', ')}` }, 400);
        if (kind === 'rename' && !body.newName?.trim())
          return c.json({ error: 'Missing required body field: newName' }, 400);
        const line = Number(body.line);
        const character = Number(body.character);
        if (!Number.isInteger(line) || line < 1) return c.json({ error: 'line must be a positive integer' }, 400);
        if (!Number.isInteger(character) || character < 1)
          return c.json({ error: 'character must be a positive integer' }, 400);
        try {
          const session = await resolveAuthorizedSession(loose(c), deps, workspacePath);
          return c.json(
            await queryEditorLsp(session, {
              path: body.path,
              line,
              character,
              kind,
              ...(typeof body.content === 'string' ? { content: body.content } : {}),
              ...(typeof body.newName === 'string' ? { newName: body.newName } : {}),
            }),
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          const status =
            message.includes('not available') || message.includes('current user')
              ? 403
              : message.includes('escapes') || message.includes('relative') || message.includes('required')
                ? 400
                : 500;
          return c.json({ error: message }, status);
        }
      },
    }),
    registerApiRoute('/web/workspace/file/original', {
      method: 'GET',
      requiresAuth: false,
      handler: async c => {
        const workspacePath = c.req.query('workspacePath');
        const path = c.req.query('path');
        if (!workspacePath) return c.json({ error: 'Missing required query param: workspacePath' }, 400);
        if (!path) return c.json({ error: 'Missing required query param: path' }, 400);
        try {
          const session = await resolveAuthorizedSession(loose(c), deps, workspacePath);
          return c.json(await readEditorFileOriginal(session, path));
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          const status =
            message.includes('not available') || message.includes('current user')
              ? 403
              : message.includes('escapes') || message.includes('relative') || message.includes('required')
                ? 400
                : 500;
          return c.json({ error: message }, status);
        }
      },
    }),
    registerApiRoute('/web/workspace/search', {
      method: 'GET',
      requiresAuth: false,
      handler: async c => {
        const workspacePath = c.req.query('workspacePath');
        const query = c.req.query('q') ?? '';
        const path = c.req.query('path') ?? '';
        if (!workspacePath) return c.json({ error: 'Missing required query param: workspacePath' }, 400);
        try {
          const session = await resolveAuthorizedSession(loose(c), deps, workspacePath);
          return c.json(await searchEditorContents(session, query, { path }));
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          const status =
            message.includes('not available') || message.includes('current user')
              ? 403
              : message.includes('escapes') || message.includes('relative')
                ? 400
                : 500;
          return c.json({ error: message }, status);
        }
      },
    }),
  ];
}
