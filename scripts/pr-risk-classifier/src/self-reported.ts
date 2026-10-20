import type { Risk } from './types.ts';

const INLINE = /^[\s>*_-]*risk[\s*_]*[:：][\s*_`]*(low|medium|high)\b/im;
const HEADING = /^#{1,6}\s*risk\s*:?\s*$/im;

/** Reads the author's `Risk: low|medium|high` line (or a `## Risk` section) from the PR body. */
export function parseSelfReportedRisk(body: string | null | undefined): Risk | null {
  if (!body) return null;
  const text = body.replace(/<!--[\s\S]*?-->/g, '');

  const inline = INLINE.exec(text);
  if (inline) return inline[1]!.toLowerCase() as Risk;

  const heading = HEADING.exec(text);
  if (heading) {
    const after = text.slice(heading.index + heading[0].length);
    const firstLine = after.split('\n').find(line => line.trim() !== '');
    const match = firstLine && /^[\s>*_`-]*(low|medium|high)\b/i.exec(firstLine);
    if (match) return match[1]!.toLowerCase() as Risk;
  }
  return null;
}
