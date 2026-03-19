const ANCHOR_ID_PATTERN = /^\[(O\d+(?:-N\d+)?)\]\s*/;
const OBSERVATION_DATE_HEADER_PATTERN = /^\s*Date:\s+/;
const XML_TAG_PATTERN = /^\s*<\/?[a-z][^>]*>\s*$/i;
const MARKDOWN_GROUP_HEADING_PATTERN = /^\s*##\s+Group\s+`[^`]+`\s*$/;
const MARKDOWN_GROUP_METADATA_PATTERN = /^\s*_range:\s*`[^`]*`_\s*$/;

function buildEphemeralAnchorId(topLevelCounter: number, nestedCounter: number): string {
  return nestedCounter === 0 ? `O${topLevelCounter}` : `O${topLevelCounter}-N${nestedCounter}`;
}

export function parseAnchorId(line: string): string | null {
  const match = line.match(ANCHOR_ID_PATTERN);
  return match?.[1] ?? null;
}

function shouldAnchorLine(line: string): boolean {
  const trimmed = line.trim();

  if (!trimmed) {
    return false;
  }

  if (parseAnchorId(trimmed)) {
    return false;
  }

  if (OBSERVATION_DATE_HEADER_PATTERN.test(trimmed)) {
    return false;
  }

  if (XML_TAG_PATTERN.test(trimmed)) {
    return false;
  }

  if (MARKDOWN_GROUP_HEADING_PATTERN.test(trimmed) || MARKDOWN_GROUP_METADATA_PATTERN.test(trimmed)) {
    return false;
  }

  return true;
}

function getIndentationDepth(line: string): number {
  const leadingWhitespace = line.match(/^\s*/)?.[0] ?? '';
  return Math.floor(leadingWhitespace.replace(/\t/g, '  ').length / 2);
}

export function injectAnchorIds(observations: string): string {
  if (!observations) {
    return observations;
  }

  const lines = observations.split('\n');
  let topLevelCounter = 0;
  let nestedCounter = 0;
  let changed = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;

    if (!shouldAnchorLine(line)) {
      continue;
    }

    const indentationDepth = getIndentationDepth(line);
    if (indentationDepth === 0) {
      topLevelCounter += 1;
      nestedCounter = 0;
    } else {
      if (topLevelCounter === 0) {
        topLevelCounter = 1;
      }
      nestedCounter += 1;
    }

    const anchorId = buildEphemeralAnchorId(topLevelCounter, nestedCounter);
    const leadingWhitespace = line.match(/^\s*/)?.[0] ?? '';
    lines[i] = `${leadingWhitespace}[${anchorId}] ${line.slice(leadingWhitespace.length)}`;
    changed = true;
  }

  return changed ? lines.join('\n') : observations;
}

export function stripEphemeralAnchorIds(observations: string): string {
  if (!observations) {
    return observations;
  }

  return observations.replace(/(^|\n)([^\S\n]*)\[(O\d+(?:-N\d+)?)\][^\S\n]*/g, '$1$2');
}
