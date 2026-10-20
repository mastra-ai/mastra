import type { FileKind, PullFile, Risk } from './types.ts';

const TEST_PATTERNS = [
  /(^|\/)(test|tests|__tests__|__fixtures__|__recordings__|__snapshots__|__mocks__)\//,
  /\.(test|spec|scenario\.test)\.(ts|tsx|js|jsx|mjs|cjs)$/,
  /\.test-d\.ts$/,
  /^e2e-tests\//,
  /^test-fixtures\//,
];

export function fileKind(filename: string): FileKind {
  if (/^\.changeset\/[^/]+\.md$/.test(filename)) return 'changeset';
  if (/^\.github\/(workflows|actions)\//.test(filename)) return 'ci';
  if (/(^|\/)(pnpm-lock\.yaml|package-lock\.json|yarn\.lock)$/.test(filename)) return 'lockfile';
  if (TEST_PATTERNS.some(pattern => pattern.test(filename))) return 'test';
  if (isDocsFile(filename)) return 'docs';
  if (/(^|\/)package\.json$/.test(filename)) return 'manifest';
  if (/\.d\.[cm]?ts$/.test(filename)) return 'types';
  if (/^(examples|templates|explorations)\//.test(filename)) return 'example';
  return 'source';
}

// Markdown can be runtime input (agent skills, prompt files, automation prompts), so only
// plain documentation counts as docs.
function isDocsFile(filename: string) {
  if (filename.startsWith('.github/')) return false;
  if (/(^|\/)SKILL\.md$/.test(filename) || /(^|\/)prompts?\//.test(filename)) return false;
  if (filename.startsWith('docs/')) return true;
  return /\.(md|mdx)$/.test(filename);
}

const PREFILTER_LOW_KINDS = new Set<FileKind>(['docs', 'changeset', 'test']);

export type Prefilter = { risk: Risk; reason: string };

/** Deterministic verdict for PRs that cannot change runtime behaviour. Returns null when the model must decide. */
export function prefilter(files: PullFile[]): Prefilter | null {
  if (files.length === 0) return { risk: 'low', reason: 'The PR has no changed files.' };
  const kinds = new Set(files.map(file => fileKind(file.filename)));
  if (![...kinds].every(kind => PREFILTER_LOW_KINDS.has(kind))) return null;

  const labels = [...kinds].sort().map(kind => (kind === 'docs' ? 'documentation' : kind === 'test' ? 'tests' : 'changesets'));
  return { risk: 'low', reason: `Only ${labels.join(', ')} changed, so no shipped runtime code is affected.` };
}

export type Floor = { risk: Risk; file: string; reason: string };

/**
 * Minimum ratings the model cannot lower. The diff is untrusted input, so these keep a
 * prompt-injected "this is low risk" from hiding changes that need a careful reviewer.
 */
export function floors(files: PullFile[]): Floor[] {
  const result: Floor[] = [];
  for (const { filename } of files) {
    const kind = fileKind(filename);
    if (kind === 'ci') {
      result.push({ risk: 'medium', file: filename, reason: 'CI workflows and actions can run with repository secrets.' });
    } else if (kind === 'source' && /(^|\/)migrations?([/._-]|$)/i.test(filename)) {
      result.push({ risk: 'medium', file: filename, reason: 'Storage migrations change persisted data.' });
    } else if (kind === 'source' && (/^auth\//.test(filename) || /\/src\/(.*\/)?auth\//.test(filename))) {
      result.push({ risk: 'medium', file: filename, reason: 'Authentication and authorization code.' });
    }
  }
  return result;
}
