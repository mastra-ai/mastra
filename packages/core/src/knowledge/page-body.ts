import { estimateTokenCount, sliceByTokens } from 'tokenx';

/** Most estimated tokens of body text one `knowledge_read` returns; the rest comes by `bodyOffset`. */
export const KNOWLEDGE_READ_BODY_TOKENS = 5_000;
/** Most headings one outline lists. */
export const KNOWLEDGE_READ_OUTLINE_ENTRIES = 200;

/** A markdown heading's section: from its heading line to the next heading at its level or above. */
export interface KnowledgeBodySection {
  level: number;
  title: string;
  /** Character range in the body, heading line included. */
  start: number;
  end: number;
}

const HEADING = /^(#{1,6})[ \t]+(.+?)[ \t]*#*[ \t]*$/;
const FENCE = /^[ \t]*(```|~~~)/;

/** Markdown sections by ATX heading, in body order; headings inside fenced code are ignored. */
export function knowledgeBodySections(body: string): KnowledgeBodySection[] {
  const headings: Array<{ level: number; title: string; start: number }> = [];
  let fence: string | undefined;
  let at = 0;
  for (const line of body.split('\n')) {
    const fenced = FENCE.exec(line)?.[1];
    if (fenced) fence = fence === undefined ? fenced : fence === fenced ? undefined : fence;
    else if (fence === undefined) {
      const heading = HEADING.exec(line);
      if (heading) headings.push({ level: heading[1]!.length, title: heading[2]!.trim(), start: at });
    }
    at += line.length + 1;
  }
  return headings.map((heading, i) => {
    const next = headings.slice(i + 1).find(candidate => candidate.level <= heading.level);
    return { ...heading, end: next ? next.start : body.length };
  });
}

/** Each heading with its section's size, for an agent to pick one. */
export function knowledgeBodyOutline(body: string) {
  return knowledgeBodySections(body).map(section => ({
    level: section.level,
    title: section.title,
    tokens: estimateTokenCount(body.slice(section.start, section.end)),
  }));
}

/** The section titled `title`: an exact (case-insensitive) title first, else the only title containing it. */
export function knowledgeBodySection(
  body: string,
  title: string,
): { section: KnowledgeBodySection } | { candidates: string[] } {
  const sections = knowledgeBodySections(body);
  const wanted = title
    .trim()
    .replace(/^#+\s*/, '')
    .toLowerCase();
  const exact = sections.filter(section => section.title.toLowerCase() === wanted);
  if (exact.length >= 1) return { section: exact[0]! };
  const partial = sections.filter(section => section.title.toLowerCase().includes(wanted));
  if (partial.length === 1) return { section: partial[0]! };
  return { candidates: (partial.length ? partial : sections).map(section => section.title).slice(0, 10) };
}

/** A matching section longer than this comes back as its matching paragraphs instead of whole. */
export const KNOWLEDGE_READ_MATCH_SECTION_TOKENS = 1_000;

/**
 * The parts of a body that contain `term` (case-insensitive): each smallest section (heading to the
 * next heading of any level) holding a match, with its heading, plus text before the first heading.
 * A section longer than {@link KNOWLEDGE_READ_MATCH_SECTION_TOKENS} gives only its matching
 * paragraphs, each with the paragraph before and after, marked with where they start in the body.
 */
export function knowledgeBodyMatches(body: string, term: string): { text: string; sections: string[] } {
  const needle = term.toLowerCase();
  const sections = knowledgeBodySections(body);
  const cuts = [0, ...sections.map(section => section.start), body.length];
  const parts: string[] = [];
  const titles: string[] = [];
  for (let i = 0; i < cuts.length - 1; i++) {
    const text = body.slice(cuts[i], cuts[i + 1]);
    if (!text.toLowerCase().includes(needle)) continue;
    titles.push(i === 0 ? '(before the first heading)' : sections[i - 1]!.title);
    if (estimateTokenCount(text) <= KNOWLEDGE_READ_MATCH_SECTION_TOKENS) {
      parts.push(text.trimEnd());
      continue;
    }
    parts.push(
      matchingParagraphs(
        text,
        cuts[i]!,
        needle,
        i === 0 ? undefined : text.slice(0, text.indexOf('\n') + 1 || text.length),
      ),
    );
  }
  return { text: parts.join('\n\n'), sections: titles };
}

function matchingParagraphs(text: string, base: number, needle: string, heading: string | undefined): string {
  const paragraphs: { start: number; end: number }[] = [];
  const gap = /\n[ \t]*\n/g;
  let start = 0;
  for (let m = gap.exec(text); m; m = gap.exec(text)) {
    paragraphs.push({ start, end: m.index });
    start = m.index + m[0].length;
  }
  paragraphs.push({ start, end: text.length });
  const keep = new Set<number>();
  paragraphs.forEach((paragraph, i) => {
    if (heading && i === 0) return;
    if (!text.slice(paragraph.start, paragraph.end).toLowerCase().includes(needle)) return;
    for (const j of [i - 1, i, i + 1]) if (j >= (heading ? 1 : 0) && j < paragraphs.length) keep.add(j);
  });
  const out: string[] = heading ? [heading.trimEnd()] : [];
  let previous = -2;
  for (const i of [...keep].sort((a, b) => a - b)) {
    if (i !== previous + 1) out.push(`[… body character ${base + paragraphs[i]!.start} …]`);
    out.push(text.slice(paragraphs[i]!.start, paragraphs[i]!.end).trimEnd());
    previous = i;
  }
  return out.join('\n\n');
}

/**
 * Up to {@link KNOWLEDGE_READ_BODY_TOKENS} of `text` from character `offset`, never splitting a
 * surrogate pair, with how much is left.
 */
export function knowledgeBodyWindow(
  text: string,
  offset: number,
): { text: string; start: number; end: number; total: number; remainingTokens: number } {
  const start = Math.min(Math.max(offset, 0), text.length);
  const rest = text.slice(start);
  let piece =
    estimateTokenCount(rest) > KNOWLEDGE_READ_BODY_TOKENS ? sliceByTokens(rest, 0, KNOWLEDGE_READ_BODY_TOKENS) : rest;
  const last = piece.charCodeAt(piece.length - 1);
  if (piece.length < rest.length && last >= 0xd800 && last <= 0xdbff) piece = piece.slice(0, -1);
  const end = start + piece.length;
  return {
    text: piece,
    start,
    end,
    total: text.length,
    remainingTokens: end < text.length ? estimateTokenCount(text.slice(end)) : 0,
  };
}
