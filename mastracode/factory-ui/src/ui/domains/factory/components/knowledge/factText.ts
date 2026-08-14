/** Split fact text into plain-text and [[wikilink]] segments for rendering. */

export type FactSegment = { type: 'text'; value: string } | { type: 'wikilink'; value: string };

const WIKILINK = /\[\[([^\]]+)\]\]/g;

export function parseFactSegments(text: string): FactSegment[] {
  const segments: FactSegment[] = [];
  let last = 0;
  for (const match of text.matchAll(WIKILINK)) {
    if (match.index > last) segments.push({ type: 'text', value: text.slice(last, match.index) });
    segments.push({ type: 'wikilink', value: match[1]! });
    last = match.index + match[0].length;
  }
  if (last < text.length) segments.push({ type: 'text', value: text.slice(last) });
  return segments;
}
