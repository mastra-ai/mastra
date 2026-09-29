/**
 * Argument parsing for `/schedules create <interval> <prompt | file [extra prompt]>`.
 *
 * The first token after the interval is probed as a file path. An existing
 * file becomes the schedule's source (executed or read at fire time); a token
 * that merely looks like a path but does not exist falls back to prompt text
 * with a warning, so a typo never silently creates a schedule against nothing.
 */
import * as path from 'node:path';
import { parseInterval, validateInterval } from './interval.js';

export type ScheduleFileMode = 'exec' | 'prompt';

export type ScheduleCreateSpec = {
  interval: { ms: number; label: string };
  prompt?: string;
  file?: { path: string; displayPath: string; mode: ScheduleFileMode };
  extraPrompt?: string;
  warning?: string;
};

export type ScheduleCreateArgsOptions = {
  cwd: string;
  fileExists: (absPath: string) => boolean;
  isExecutable: (absPath: string) => boolean;
  homeDir?: string;
};

/** Extensions that mark a file as a script to run rather than text to read. */
export const EXEC_EXTENSIONS = new Set(['.sh', '.js', '.mjs', '.cjs', '.ts', '.py']);

const PATH_PREFIX_RE = /^(\.\/|\.\.\/|~\/|\/)/;
const FILE_EXTENSION_RE = /\.[A-Za-z0-9]+$/;

/** Heuristic: does this token look like it is meant to be a file path? */
export function looksLikePath(token: string): boolean {
  return PATH_PREFIX_RE.test(token) || token.includes('/') || FILE_EXTENSION_RE.test(token);
}

/** Drop one pair of matching quotes wrapping the whole text: `"check it"` → `check it`. */
function stripWrappingQuotes(text: string): string {
  const match = /^(["'])([\s\S]*)\1$/.exec(text);
  return match ? match[2]!.trim() : text;
}

function expandHome(token: string, homeDir: string | undefined): string {
  if (token.startsWith('~/') && homeDir) return path.join(homeDir, token.slice(2));
  return token;
}

export function parseScheduleCreateArgs(
  args: string[],
  options: ScheduleCreateArgsOptions,
): ScheduleCreateSpec | { error: string } {
  const [intervalToken, ...rest] = args;
  if (!intervalToken) {
    return { error: 'Usage: /schedules create <interval> <prompt | file [extra prompt]>' };
  }

  // Allow "5 minutes" (two tokens) as well as "5m" by trying the merged form first.
  let interval = parseInterval(intervalToken);
  let remaining = rest;
  if ('error' in interval && rest[0] && /^\d+$/.test(intervalToken)) {
    const merged = parseInterval(`${intervalToken} ${rest[0]}`);
    if (!('error' in merged)) {
      interval = merged;
      remaining = rest.slice(1);
    }
  }
  if ('error' in interval) return { error: interval.error };

  const check = validateInterval(interval);
  if ('error' in check) {
    const suggestion = check.suggestion ? ` Try ${check.suggestion}.` : '';
    return { error: `${check.error}${suggestion}` };
  }

  if (remaining.length === 0) {
    return { error: 'Provide a prompt or a file path after the interval.' };
  }

  const spec: ScheduleCreateSpec = { interval };

  const firstToken = remaining[0]!;
  if (looksLikePath(firstToken)) {
    const absPath = path.resolve(options.cwd, expandHome(firstToken, options.homeDir));
    if (options.fileExists(absPath)) {
      const ext = path.extname(absPath).toLowerCase();
      const mode: ScheduleFileMode = options.isExecutable(absPath) || EXEC_EXTENSIONS.has(ext) ? 'exec' : 'prompt';
      spec.file = { path: absPath, displayPath: firstToken, mode };
      const extra = stripWrappingQuotes(remaining.slice(1).join(' ').trim());
      if (extra) spec.extraPrompt = extra;
      return spec;
    }
    spec.warning = `"${firstToken}" looks like a path but was not found; using it as prompt text.`;
  }

  spec.prompt = stripWrappingQuotes(remaining.join(' ').trim());
  if (!spec.prompt) return { error: 'Provide a prompt or a file path after the interval.' };
  return spec;
}
