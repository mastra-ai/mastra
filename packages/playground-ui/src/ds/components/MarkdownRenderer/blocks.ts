const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})/;
const FENCE_CLOSE = /^ {0,3}(`{3,}|~{3,})[ \t]*$/;
const LIST_ITEM = /^ {0,3}(?:[-*+]|\d{1,9}[.)])(?:[ \t]|$)/;
const INDENTED = /^(?:\t| {2,})/;
const DEFINITION = /^ {0,3}\[[^\]]+\]:/;

function fenceOpenedBy(line: string): string | undefined {
  return FENCE_OPEN.exec(line)?.[1];
}

// Both are runs of one character, so `startsWith` is "same marker, at least as long".
function closesFence(line: string, marker: string): boolean {
  return FENCE_CLOSE.exec(line)?.[1]?.startsWith(marker) ?? false;
}

function startsBlock(line: string, inList: boolean): boolean {
  if (INDENTED.test(line)) return false;

  return !(inList && LIST_ITEM.test(line));
}

/**
 * Cuts markdown into top-level blocks so a growing reply re-parses its last
 * block instead of all of them. Rejoining the result returns the input, and
 * every block renders as it would have inside the whole.
 *
 * Each rule only ever merges: over-merging costs a re-parse, while cutting a
 * construct in two changes what it renders as. Link reference and footnote
 * definitions resolve across blank lines, which no line-level rule can see, so
 * reaching one outside a fence abandons the split for the whole text.
 */
export function splitBlocks(markdown: string): string[] {
  const lines = markdown.split('\n');
  const starts = [0];
  let fence: string | undefined;
  let started = false;
  let broken = false;
  let inList = false;

  for (const [index, line] of lines.entries()) {
    if (fence) {
      if (closesFence(line, fence)) fence = undefined;
      continue;
    }

    if (line.trim() === '') {
      broken = started;
      continue;
    }

    if (DEFINITION.test(line)) return [markdown];

    if (broken && startsBlock(line, inList)) {
      starts.push(index);
      started = false;
    }

    if (!started) inList = LIST_ITEM.test(line);

    started = true;
    broken = false;
    fence = fenceOpenedBy(line);
  }

  return starts.map((start, position) => {
    const end = starts[position + 1];
    const block = lines.slice(start, end ?? lines.length).join('\n');

    return end === undefined ? block : `${block}\n`;
  });
}
