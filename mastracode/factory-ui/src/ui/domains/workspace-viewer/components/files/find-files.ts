export interface FileMatch {
  path: string;
  matched: number[];
}

export interface FoundFiles {
  matches: FileMatch[];
  total: number;
}

const SEPARATORS = '/.-_ ';

function positions(text: string, query: string, from: number): number[] | undefined {
  const contiguous = text.lastIndexOf(query);
  if (contiguous >= from) return Array.from(query, (_, i) => contiguous + i);
  const found: number[] = [];
  let cursor = from;
  for (const char of query) {
    const at = text.indexOf(char, cursor);
    if (at === -1) return undefined;
    found.push(at);
    cursor = at + 1;
  }
  return found;
}

function startsWord(path: string, at: number): boolean {
  if (at === 0) return true;
  const before = path[at - 1];
  if (SEPARATORS.includes(before)) return true;
  const char = path[at];
  return before === before.toLowerCase() && char !== char.toLowerCase();
}

function score(path: string, matched: number[], nameStart: number, boosted: boolean): number {
  let total = 0;
  matched.forEach((at, i) => {
    if (at >= nameStart) total += 10;
    if (startsWord(path, at)) total += 8;
    if (i > 0 && matched[i - 1] === at - 1) total += 6;
  });
  if (matched[0] === nameStart) total += 20;
  if (boosted) total += 25;
  return total - path.length / 10;
}

// Lowercasing can lengthen a string ("İ"), which would move every matched position off the path.
function lowerCased(text: string): string {
  const lower = text.toLowerCase();
  if (lower.length === text.length) return lower;
  return Array.from(text, character => {
    const lowered = character.toLowerCase();
    return lowered.length === character.length ? lowered : character;
  }).join('');
}

export function findFiles(
  paths: readonly string[],
  query: string,
  { limit, boost }: { limit: number; boost?: Pick<ReadonlySet<string>, 'has'> },
): FoundFiles {
  const needle = lowerCased(query).replace(/\s+/g, '');
  if (!needle) return { matches: [], total: 0 };
  const ranked: { match: FileMatch; score: number }[] = [];
  for (const path of paths) {
    const lower = lowerCased(path);
    const nameStart = lower.lastIndexOf('/') + 1;
    const matched = positions(lower, needle, nameStart) ?? positions(lower, needle, 0);
    if (!matched) continue;
    ranked.push({ match: { path, matched }, score: score(path, matched, nameStart, boost?.has(path) ?? false) });
  }
  ranked.sort((a, b) => b.score - a.score);
  return { matches: ranked.slice(0, limit).map(entry => entry.match), total: ranked.length };
}
