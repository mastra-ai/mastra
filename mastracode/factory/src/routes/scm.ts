/**
 * Source-control operations for the embedded editor: status, staging (whole
 * files and single hunks), unstaging, and committing — the minimum loop for
 * reviewing and landing agent work without leaving the editor.
 *
 *   - GET  /web/workspace/scm/status?workspacePath=       → branch + staged/unstaged entries
 *   - GET  /web/workspace/scm/diff?workspacePath=&path=   → unstaged unified diff for one file
 *   - POST /web/workspace/scm/stage?workspacePath=        → git add   { paths }
 *   - POST /web/workspace/scm/unstage?workspacePath=      → git reset { paths }
 *   - POST /web/workspace/scm/stage-hunk?workspacePath=   → git apply --cached { patch }
 *   - POST /web/workspace/scm/commit?workspacePath=       → git commit { message }
 */

import { randomBytes } from 'node:crypto';

import { registerApiRoute } from '@mastra/core/server';
import type { ApiRoute } from '@mastra/core/server';
import type { Context } from 'hono';

import type { SourceControlSession } from '../storage/domains/source-control/base.js';
import { resolveAuthorizedSession, sessionSandbox } from './editor.js';
import type { EditorSessionDeps, SessionSandboxHandle } from './editor.js';

export interface ScmEntry {
  /** Workspace-relative posix path. */
  path: string;
  /** Porcelain status char for this side: M, A, D, R, C, U or ? (untracked). */
  status: string;
}

export interface ScmStatus {
  workspacePath: string;
  /** False when the workdir is not a git checkout (or the sandbox is gone). */
  available: boolean;
  branch?: string;
  staged: ScmEntry[];
  unstaged: ScmEntry[];
}

export interface ScmDiff {
  workspacePath: string;
  path: string;
  /** Raw unified diff of the unstaged changes; empty for untracked/binary. */
  diff: string;
}

export interface ScmActionResult {
  workspacePath: string;
  ok: boolean;
  /** Stdout+stderr of the git command, for surfacing hook/commit output. */
  output: string;
}

const MAX_PATHS = 200;
const MAX_MESSAGE_BYTES = 10_000;
const MAX_PATCH_BYTES = 1024 * 1024;
const MAX_DIFF_BYTES = 1024 * 1024;

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function assertScmPath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed || trimmed.startsWith('/') || trimmed.startsWith('-') || trimmed.split(/[\\/]+/).includes('..')) {
    throw new Error('paths must be relative workspace paths');
  }
  return trimmed;
}

async function requireHandle(session: SourceControlSession): Promise<SessionSandboxHandle> {
  const handle = await sessionSandbox(session);
  if (!handle) throw new Error('The session sandbox is not available');
  return handle;
}

async function runGit(
  handle: SessionSandboxHandle,
  gitArgs: string,
  timeout = 30_000,
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const script = `cd ${shellQuote(handle.workdir)} && git ${gitArgs}`;
  return handle.sandbox.executeCommand('sh', ['-c', script], { timeout });
}

/**
 * Parse `git status --porcelain=v1 -z` output. Entries are NUL-separated;
 * renames/copies carry the original path as an extra NUL-separated token.
 */
function parsePorcelain(raw: string): { staged: ScmEntry[]; unstaged: ScmEntry[] } {
  const staged: ScmEntry[] = [];
  const unstaged: ScmEntry[] = [];
  const tokens = raw.split('\u0000');
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    if (!token || token.length < 4) continue;
    const x = token[0]!;
    const y = token[1]!;
    const path = token.slice(3);
    if (x === 'R' || x === 'C') index++; // Skip the rename/copy source token.
    if (x === '?' && y === '?') {
      unstaged.push({ path, status: '?' });
      continue;
    }
    if (x !== ' ' && x !== '?') staged.push({ path, status: x });
    if (y !== ' ' && y !== '?') unstaged.push({ path, status: y });
  }
  return { staged, unstaged };
}

export async function readScmStatus(session: SourceControlSession): Promise<ScmStatus> {
  const empty: ScmStatus = { workspacePath: session.sessionId, available: false, staged: [], unstaged: [] };
  const handle = await sessionSandbox(session);
  if (!handle) return empty;

  const branchResult = await runGit(handle, 'rev-parse --abbrev-ref HEAD 2>/dev/null', 10_000);
  if (branchResult.exitCode !== 0) return empty;
  const statusResult = await runGit(handle, 'status --porcelain=v1 -z', 20_000);
  if (statusResult.exitCode !== 0) return empty;

  const { staged, unstaged } = parsePorcelain(statusResult.stdout);
  return {
    workspacePath: session.sessionId,
    available: true,
    branch: branchResult.stdout.trim() || undefined,
    staged,
    unstaged,
  };
}

export async function readScmDiff(session: SourceControlSession, path: string): Promise<ScmDiff> {
  const safe = assertScmPath(path);
  const handle = await requireHandle(session);
  const result = await runGit(handle, `diff --no-color --no-ext-diff -- ${shellQuote(safe)}`, 20_000);
  const diff = result.exitCode === 0 && result.stdout.length <= MAX_DIFF_BYTES ? result.stdout : '';
  return { workspacePath: session.sessionId, path: safe, diff };
}

export async function stageScmPaths(
  session: SourceControlSession,
  paths: string[],
  direction: 'stage' | 'unstage',
): Promise<ScmActionResult> {
  if (!Array.isArray(paths) || paths.length === 0) throw new Error('paths is required');
  if (paths.length > MAX_PATHS) throw new Error('too many paths');
  const safe = paths.map(assertScmPath).map(shellQuote).join(' ');
  const handle = await requireHandle(session);
  // `reset -q --` unstages without touching the worktree and works on git
  // versions that predate `restore --staged`.
  const result =
    direction === 'stage' ? await runGit(handle, `add -- ${safe}`) : await runGit(handle, `reset -q -- ${safe}`);
  return {
    workspacePath: session.sessionId,
    ok: result.exitCode === 0,
    output: `${result.stdout}${result.stderr}`.trim(),
  };
}

export async function stageScmHunk(session: SourceControlSession, patch: string): Promise<ScmActionResult> {
  if (!patch?.trim()) throw new Error('patch is required');
  if (patch.length > MAX_PATCH_BYTES) throw new Error('patch too large');
  const handle = await requireHandle(session);
  // The patch travels as a quoted heredoc so no shell escaping applies to its
  // body; a random delimiter prevents collisions with patch content.
  const delimiter = `MASTRA_PATCH_${randomBytes(8).toString('hex')}`;
  const body = patch.endsWith('\n') ? patch : `${patch}\n`;
  if (body.includes(delimiter)) throw new Error('patch could not be transported');
  const script = `cd ${shellQuote(handle.workdir)} && git apply --cached - <<'${delimiter}'\n${body}${delimiter}`;
  const result = await handle.sandbox.executeCommand('sh', ['-c', script], { timeout: 20_000 });
  return {
    workspacePath: session.sessionId,
    ok: result.exitCode === 0,
    output: `${result.stdout}${result.stderr}`.trim(),
  };
}

export async function commitScm(session: SourceControlSession, message: string): Promise<ScmActionResult> {
  const trimmed = message?.trim();
  if (!trimmed) throw new Error('message is required');
  if (trimmed.length > MAX_MESSAGE_BYTES) throw new Error('message too large');
  const handle = await requireHandle(session);
  // Fall back to a neutral identity only when the checkout has none — a
  // configured user.name/email always wins.
  const quotedMessage = shellQuote(trimmed);
  const script = `cd ${shellQuote(handle.workdir)} && if git config user.email >/dev/null 2>&1; then git commit -m ${quotedMessage}; else git -c user.name='Mastra Editor' -c user.email='editor@mastra.local' commit -m ${quotedMessage}; fi`;
  const result = await handle.sandbox.executeCommand('sh', ['-c', script], { timeout: 60_000 });
  return {
    workspacePath: session.sessionId,
    ok: result.exitCode === 0,
    output: `${result.stdout}${result.stderr}`.trim(),
  };
}

function errorStatus(message: string): 400 | 403 | 500 {
  if (message.includes('not available') || message.includes('current user')) return 403;
  if (
    message.includes('required') ||
    message.includes('relative') ||
    message.includes('too large') ||
    message.includes('too many') ||
    message.includes('transported')
  ) {
    return 400;
  }
  return 500;
}

/** Register the `/web/workspace/scm/*` routes. */
export function buildScmRoutes(deps: EditorSessionDeps): ApiRoute[] {
  const respond = async (c: Context, run: (session: SourceControlSession) => Promise<unknown>) => {
    const workspacePath = c.req.query('workspacePath');
    if (!workspacePath) return c.json({ error: 'Missing required query param: workspacePath' }, 400);
    try {
      const session = await resolveAuthorizedSession(c, deps, workspacePath);
      return c.json(await run(session));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return c.json({ error: message }, errorStatus(message));
    }
  };

  return [
    registerApiRoute('/web/workspace/scm/status', {
      method: 'GET',
      requiresAuth: false,
      handler: c => respond(c, session => readScmStatus(session)),
    }),
    registerApiRoute('/web/workspace/scm/diff', {
      method: 'GET',
      requiresAuth: false,
      handler: c => {
        const path = c.req.query('path');
        if (!path) return c.json({ error: 'Missing required query param: path' }, 400);
        return respond(c, session => readScmDiff(session, path));
      },
    }),
    registerApiRoute('/web/workspace/scm/stage', {
      method: 'POST',
      requiresAuth: false,
      handler: async c => {
        const body = (await c.req.json().catch(() => null)) as { paths?: string[] } | null;
        if (!body) return c.json({ error: 'Invalid JSON body' }, 400);
        return respond(c, session => stageScmPaths(session, body.paths ?? [], 'stage'));
      },
    }),
    registerApiRoute('/web/workspace/scm/unstage', {
      method: 'POST',
      requiresAuth: false,
      handler: async c => {
        const body = (await c.req.json().catch(() => null)) as { paths?: string[] } | null;
        if (!body) return c.json({ error: 'Invalid JSON body' }, 400);
        return respond(c, session => stageScmPaths(session, body.paths ?? [], 'unstage'));
      },
    }),
    registerApiRoute('/web/workspace/scm/stage-hunk', {
      method: 'POST',
      requiresAuth: false,
      handler: async c => {
        const body = (await c.req.json().catch(() => null)) as { patch?: string } | null;
        if (!body) return c.json({ error: 'Invalid JSON body' }, 400);
        return respond(c, session => stageScmHunk(session, body.patch ?? ''));
      },
    }),
    registerApiRoute('/web/workspace/scm/commit', {
      method: 'POST',
      requiresAuth: false,
      handler: async c => {
        const body = (await c.req.json().catch(() => null)) as { message?: string } | null;
        if (!body) return c.json({ error: 'Invalid JSON body' }, 400);
        return respond(c, session => commitScm(session, body.message ?? ''));
      },
    }),
  ];
}
