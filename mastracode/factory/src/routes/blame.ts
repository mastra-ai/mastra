/**
 * Git blame for the embedded editor. Returns one entry per line with the
 * short commit hash, author, timestamp, and summary. The editor renders a
 * toggleable gutter that highlights lines authored by the Mastra agent so
 * reviewers can see attribution at a glance.
 *
 *   - GET /web/workspace/blame?workspacePath=&path=
 */

import { registerApiRoute } from '@mastra/core/server';
import type { ApiRoute } from '@mastra/core/server';
import type { Context } from 'hono';

import type { SourceControlSession } from '../storage/domains/source-control/base.js';
import { resolveAuthorizedSession, sessionSandbox } from './editor.js';
import type { EditorSessionDeps, SessionSandboxHandle } from './editor.js';

export interface BlameLine {
  /** 1-indexed source line number. */
  line: number;
  /** Short (8-char) commit hash. */
  sha: string;
  /** Author name reported by git. */
  author: string;
  /** Author email (best-effort; empty if not available). */
  email: string;
  /** Author timestamp in ISO-8601 with timezone offset. */
  time: string;
  /** Commit summary (first line of the message), trimmed. */
  summary: string;
  /** True for lines still being edited (git reports 0000000 hash). */
  uncommitted: boolean;
  /** True when the commit author matches the Mastra agent identity heuristics. */
  agent: boolean;
}

export interface BlameResult {
  workspacePath: string;
  path: string;
  /** True when the file is tracked and blame data was produced. */
  available: boolean;
  lines: BlameLine[];
}

const MAX_BLAME_BYTES = 4 * 1024 * 1024;
const AGENT_MATCHERS = [/mastra/i, /agent/i, /mastracode/i, /editor@mastra/i];

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function assertBlamePath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed || trimmed.startsWith('/') || trimmed.startsWith('-') || trimmed.split(/[\\/]+/).includes('..')) {
    throw new Error('path must be a relative workspace path');
  }
  return trimmed;
}

async function requireHandle(session: SourceControlSession): Promise<SessionSandboxHandle> {
  const handle = await sessionSandbox(session);
  if (!handle) throw new Error('The session sandbox is not available');
  return handle;
}

function isoFromEpoch(epoch: number, tz: string): string {
  const iso = new Date(epoch * 1000).toISOString().replace('.000Z', '');
  const sign = tz.startsWith('-') ? '-' : '+';
  const offset = tz.replace(/^[+-]/, '');
  const hours = offset.slice(0, 2);
  const minutes = offset.slice(2, 4);
  return `${iso}${sign}${hours}:${minutes}`;
}

/**
 * Parse `git blame --porcelain` output into per-line entries. Header blocks
 * introduce a commit once ("<sha> <origLine> <finalLine> <groupSize>") and
 * subsequent lines within the same group repeat only the sha + line pair.
 */
export function parseBlamePorcelain(raw: string): BlameLine[] {
  const commits = new Map<string, Partial<BlameLine>>();
  const out: BlameLine[] = [];
  const lines = raw.split('\n');
  let index = 0;
  while (index < lines.length) {
    const header = lines[index++];
    if (!header) continue;
    const match = /^([0-9a-f]{40})\s+(\d+)\s+(\d+)(?:\s+(\d+))?$/.exec(header);
    if (!match) continue;
    const sha = match[1]!;
    const finalLine = Number(match[3]);
    const record = commits.get(sha) ?? { sha };
    let authorTime: number | undefined;
    let authorTz = '+0000';
    let content = '';
    while (index < lines.length) {
      const line = lines[index];
      if (line === undefined) break;
      if (line.startsWith('\t')) {
        content = line.slice(1);
        index++;
        break;
      }
      const spaceIndex = line.indexOf(' ');
      const key = spaceIndex === -1 ? line : line.slice(0, spaceIndex);
      const value = spaceIndex === -1 ? '' : line.slice(spaceIndex + 1);
      if (key === 'author') record.author = value;
      else if (key === 'author-mail') record.email = value.replace(/^<|>$/g, '');
      else if (key === 'author-time') authorTime = Number(value);
      else if (key === 'author-tz') authorTz = value;
      else if (key === 'summary') record.summary = value;
      index++;
    }
    commits.set(sha, record);
    const uncommitted = /^0+$/.test(sha);
    const author = record.author ?? '';
    const email = record.email ?? '';
    const agent = !uncommitted && AGENT_MATCHERS.some(re => re.test(author) || re.test(email));
    // `content` is captured while parsing so groups end at the actual code
    // line, but the response omits it because the editor already has the text.
    void content;
    out.push({
      line: finalLine,
      sha: sha.slice(0, 8),
      author,
      email,
      time: authorTime ? isoFromEpoch(authorTime, authorTz) : '',
      summary: (record.summary ?? '').trim(),
      uncommitted,
      agent,
    });
  }
  return out;
}

export async function readBlame(session: SourceControlSession, path: string): Promise<BlameResult> {
  const safe = assertBlamePath(path);
  const handle = await requireHandle(session);
  const script = `cd ${shellQuote(handle.workdir)} && git rev-parse --is-inside-work-tree >/dev/null 2>&1 && git blame --porcelain -- ${shellQuote(safe)}`;
  const result = await handle.sandbox.executeCommand('sh', ['-c', script], { timeout: 20_000 });
  if (result.exitCode !== 0 || result.stdout.length > MAX_BLAME_BYTES) {
    return { workspacePath: session.sessionId, path: safe, available: false, lines: [] };
  }
  return {
    workspacePath: session.sessionId,
    path: safe,
    available: true,
    lines: parseBlamePorcelain(result.stdout),
  };
}

function errorStatus(message: string): 400 | 403 | 500 {
  if (message.includes('not available')) return 403;
  if (message.includes('relative') || message.includes('required')) return 400;
  return 500;
}

/** Register the `/web/workspace/blame` route. */
export function buildBlameRoutes(deps: EditorSessionDeps): ApiRoute[] {
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
    registerApiRoute('/web/workspace/blame', {
      method: 'GET',
      requiresAuth: false,
      handler: c => {
        const path = c.req.query('path');
        if (!path) return c.json({ error: 'Missing required query param: path' }, 400);
        return respond(c, session => readBlame(session, path));
      },
    }),
  ];
}
