/**
 * A plan a session submitted with `submit_plan`, read back from its file so
 * the people asked to approve it see what it says. Every value is quoted from
 * the file (cut short with "…"), never paraphrased.
 */

import { posix as posixPath } from 'node:path';

/** What a plan file says, split by the headings Factory plans use. */
export interface PlanDigest {
  ok: true;
  /** The workspace-relative path the plan was read from. */
  path: string;
  /** The leading `# Title`, as the web card and the TUI read it. */
  title?: string;
  goal?: string;
  scope?: string;
  /** The `###` headings of the Phases section (or of the whole plan when it has none). */
  phases: string[];
  risks?: string;
  openQuestions?: string;
  /** The plan without its title. */
  body: string;
}

export type PlanDigestResult = PlanDigest | { ok: false; path: string; reason: string };

/** Reads a workspace-relative file of the session that submitted the plan. */
export type PlanFileRead = (relativePath: string) => Promise<{ content?: string; contentType?: string }>;

/** Where plans live, relative to the workspace or to one checkout in it. */
const PLANS_DIR_PATTERN = /^(?:[^/]+\/)?\.artifacts\/plans\/[^/].*$/;

/** How long a section may run in the text digest before it is cut. */
const SECTION_LENGTH = { goal: 800, scope: 1000, risks: 600, openQuestions: 500, excerpt: 1500 } as const;

/** How many phase names the text digest lists. */
const PHASE_COUNT = 12;

/**
 * The workspace-relative path of a plan file, or `null` when it is not under a
 * plans directory. An absolute path is read against the workspace root.
 */
export function planFilePath(path: string, root?: string): string | null {
  const trimmed = path.trim();
  if (!trimmed) return null;
  let relative = trimmed;
  if (posixPath.isAbsolute(trimmed)) {
    if (!root) return null;
    relative = posixPath.relative(root, trimmed);
  }
  relative = posixPath.normalize(relative).replace(/^\.\//, '');
  if (relative.split('/').includes('..')) return null;
  return PLANS_DIR_PATTERN.test(relative) ? relative : null;
}

/** Read and digest the plan at `path`; never throws. */
export async function readPlanDigest(path: string, read: PlanFileRead, root?: string): Promise<PlanDigestResult> {
  const relative = planFilePath(path, root);
  if (!relative) return { ok: false, path, reason: 'it is not in the plans directory' };
  try {
    const file = await read(relative);
    if (file.contentType === 'unsupported' || typeof file.content !== 'string') {
      return { ok: false, path: relative, reason: 'it is not a text file' };
    }
    if (!file.content.trim()) return { ok: false, path: relative, reason: 'it is empty' };
    return parsePlanDigest(relative, file.content);
  } catch (error) {
    return { ok: false, path: relative, reason: error instanceof Error ? error.message : String(error) };
  }
}

type SectionKey = 'goal' | 'scope' | 'phases' | 'risks' | 'openQuestions';

function sectionKey(heading: string): SectionKey | undefined {
  const name = heading
    .toLowerCase()
    .replace(/[^a-z ]/g, '')
    .trim();
  if (/^goals?\b/.test(name) || name === 'objective' || name === 'summary') return 'goal';
  if (/^scope\b/.test(name)) return 'scope';
  if (/^(phases|steps|implementation|plan)\b/.test(name)) return 'phases';
  if (/^risks?\b/.test(name)) return 'risks';
  if (/^open questions?\b/.test(name) || /^questions\b/.test(name)) return 'openQuestions';
  return undefined;
}

/** Split a plan's markdown into its title and the sections a reviewer needs. */
export function parsePlanDigest(path: string, raw: string): PlanDigest {
  const lines = raw.split(/\r?\n/);
  const headingIndex = lines.findIndex(line => line.trim().length > 0);
  const heading = headingIndex >= 0 ? lines[headingIndex] : undefined;
  const hasTitle = Boolean(heading?.startsWith('# '));
  const title = hasTitle ? heading!.slice(2).trim() : undefined;
  const bodyLines = hasTitle ? lines.slice(headingIndex + 1) : lines;
  const body = bodyLines.join('\n').trim();

  const sections: Partial<Record<SectionKey, string[]>> = {};
  let current: SectionKey | undefined;
  let inFence = false;
  const phaseHeadings: string[] = [];
  const allSubheadings: string[] = [];
  for (const line of bodyLines) {
    if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;
    if (!inFence && line.startsWith('## ')) {
      current = sectionKey(line.slice(3));
      if (current && !sections[current]) sections[current] = [];
      continue;
    }
    if (!inFence && line.startsWith('### ')) {
      const name = line.slice(4).trim();
      allSubheadings.push(name);
      if (current === 'phases') phaseHeadings.push(name);
    }
    if (current) sections[current]!.push(line);
  }
  const text = (key: SectionKey) => {
    const value = sections[key]?.join('\n').trim();
    return value ? value : undefined;
  };
  const goal = text('goal');
  const scope = text('scope');
  const risks = text('risks');
  const openQuestions = text('openQuestions');
  return {
    ok: true,
    path,
    ...(title ? { title } : {}),
    ...(goal ? { goal } : {}),
    ...(scope ? { scope } : {}),
    phases: phaseHeadings.length ? phaseHeadings : allSubheadings,
    ...(risks ? { risks } : {}),
    ...(openQuestions ? { openQuestions } : {}),
    body,
  };
}

/** `text` cut to `length` characters, ending in "…" when cut. */
export function clip(text: string, length: number): string {
  const trimmed = text.trim();
  return trimmed.length > length ? `${trimmed.slice(0, Math.max(0, length - 1)).trimEnd()}…` : trimmed;
}

/** Whether the digest found any of the sections a reviewer needs. */
export function hasPlanSections(digest: PlanDigest): boolean {
  return Boolean(digest.goal || digest.scope || digest.risks || digest.openQuestions || digest.phases.length);
}

/**
 * A plain markdown digest of the plan, at most `budget` characters: its goal,
 * scope, phase names, risks and open questions, each quoted from the file.
 * A plan without those headings is quoted from its start.
 */
export function formatPlanDigestText(digest: PlanDigest, budget = 3500): string {
  const parts = [`Plan: ${digest.title ? `"${digest.title}"` : '(untitled)'} (\`${digest.path}\`)`];
  if (hasPlanSections(digest)) {
    if (digest.goal) parts.push(`Goal:\n${clip(digest.goal, SECTION_LENGTH.goal)}`);
    if (digest.scope) parts.push(`Scope:\n${clip(digest.scope, SECTION_LENGTH.scope)}`);
    if (digest.phases.length) {
      const listed = digest.phases.slice(0, PHASE_COUNT).map(name => `- ${clip(name, 160)}`);
      const more = digest.phases.length - listed.length;
      parts.push(`Phases:\n${listed.join('\n')}${more > 0 ? `\n- …and ${more} more` : ''}`);
    }
    if (digest.risks) parts.push(`Risks:\n${clip(digest.risks, SECTION_LENGTH.risks)}`);
    if (digest.openQuestions)
      parts.push(`Open questions:\n${clip(digest.openQuestions, SECTION_LENGTH.openQuestions)}`);
  } else if (digest.body) {
    parts.push(`Plan excerpt:\n${clip(digest.body, SECTION_LENGTH.excerpt)}`);
  }
  return clip(parts.join('\n\n'), budget);
}

/** What a report says about a plan it could not read. */
export function unreadablePlanText(result: { path: string; reason: string }): string {
  return `The plan file \`${result.path}\` could not be read (${result.reason}); open the session to review it before approving.`;
}
