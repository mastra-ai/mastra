import { fileKind } from './files.ts';
import type { FileContext } from './blast-radius.ts';
import type { FileKind, PullFile } from './types.ts';

export type Hunk = {
  filename: string;
  kind: FileKind;
  header: string;
  lines: string[];
  added: number;
  removed: number;
  signals: string[];
  priority: number;
  order: number;
};

export type DiffSelection = {
  included: Hunk[];
  omitted: Hunk[];
  /** Files GitHub returned without a patch (binary, too large, or rename-only). */
  withoutPatch: PullFile[];
};

const MAX_LINES_PER_HUNK = 160;
const KIND_WEIGHT: Record<FileKind, number> = {
  source: 3,
  ci: 3,
  manifest: 2.5,
  types: 1.5,
  example: 0.8,
  test: 0.6,
  docs: 0.3,
  changeset: 0.2,
  lockfile: 0,
};

export function parseHunks(file: PullFile, order: number): Hunk[] {
  if (!file.patch) return [];
  const kind = fileKind(file.filename);
  const hunks: Hunk[] = [];
  let current: Hunk | null = null;
  for (const line of file.patch.split('\n')) {
    if (line.startsWith('@@')) {
      current = { filename: file.filename, kind, header: line, lines: [], added: 0, removed: 0, signals: [], priority: 0, order: order + hunks.length };
      hunks.push(current);
      continue;
    }
    if (!current) continue;
    current.lines.push(line);
    if (line.startsWith('+')) current.added++;
    else if (line.startsWith('-')) current.removed++;
  }
  for (const hunk of hunks) hunk.signals = hunkSignals(hunk);
  return hunks;
}

const COMMENT_LINE = /^\s*(\/\/|\/\*|\*|\*\/|#(?!!)|<!--)/;

function hunkSignals(hunk: Hunk): string[] {
  const changed = hunk.lines.filter(l => l.startsWith('+') || l.startsWith('-')).map(l => l.slice(1));
  const code = changed.filter(l => l.trim() !== '' && !COMMENT_LINE.test(l));
  const signals: string[] = [];
  if (changed.length > 0 && code.length === 0) signals.push('comments-or-whitespace-only');
  if (code.some(l => /^\s*export\s/.test(l))) signals.push('changes-exports');
  if (code.some(l => /\b(ALTER|CREATE|DROP)\s+(TABLE|INDEX|COLUMN)\b|\bmigrat/i.test(l))) signals.push('schema-or-migration');
  if (code.some(l => /\b(auth|token|secret|password|permission|credential|apiKey|signature)\w*/i.test(l))) signals.push('auth-or-secrets');
  if (code.some(l => /\b(retry|retries|abort|timeout|stream|lock|mutex|concurren|await|Promise\.)/i.test(l))) signals.push('control-flow-async-or-retry');
  return signals;
}

function hunkPriority(hunk: Hunk, context: FileContext | undefined): number {
  const size = Math.log2(2 + hunk.added + hunk.removed);
  const dependents = context?.package?.transitiveDependents ?? 0;
  const reach = 1 + Math.log2(1 + dependents) / 3;
  let score = KIND_WEIGHT[hunk.kind] * size * reach;
  if (hunk.signals.includes('comments-or-whitespace-only')) score *= 0.2;
  if (hunk.removed > 0) score *= 1.2;
  score += hunk.signals.filter(s => s !== 'comments-or-whitespace-only').length;
  return score;
}

export function renderHunk(hunk: Hunk): string {
  const lines = hunk.lines.length > MAX_LINES_PER_HUNK
    ? [...hunk.lines.slice(0, MAX_LINES_PER_HUNK), `… ${hunk.lines.length - MAX_LINES_PER_HUNK} more lines in this hunk`]
    : hunk.lines;
  return `${hunk.header}\n${lines.join('\n')}`;
}

/**
 * Keeps the highest-signal hunks within a character budget. Runtime hunks in widely used
 * packages win over tests, docs and lockfiles; the kept hunks are returned in diff order.
 */
export function selectHunks(files: PullFile[], contexts: Map<string, FileContext>, budgetChars: number): DiffSelection {
  const all: Hunk[] = [];
  const withoutPatch: PullFile[] = [];
  for (const file of files) {
    const hunks = parseHunks(file, all.length);
    if (hunks.length === 0) withoutPatch.push(file);
    for (const hunk of hunks) {
      hunk.priority = hunkPriority(hunk, contexts.get(file.filename));
      all.push(hunk);
    }
  }

  const included: Hunk[] = [];
  const omitted: Hunk[] = [];
  let used = 0;
  for (const hunk of [...all].sort((a, b) => b.priority - a.priority || a.order - b.order)) {
    const size = renderHunk(hunk).length + hunk.filename.length + 16;
    if (hunk.kind !== 'lockfile' && used + size <= budgetChars) {
      included.push(hunk);
      used += size;
    } else {
      omitted.push(hunk);
    }
  }
  included.sort((a, b) => a.order - b.order);
  omitted.sort((a, b) => a.order - b.order);
  return { included, omitted, withoutPatch };
}
