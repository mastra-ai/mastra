const LEGACY_ANCHOR_ID_PATTERN = /^\[(O\d+(?:-N\d+)?)\]\s*/;
const POSITIONAL_ANCHOR_ID_PATTERN = /^\[(O\d+(?:\.\d+)*)\]\s*/;
const OBSERVATION_DATE_HEADER_PATTERN = /^\s*Date:\s+/;
const XML_TAG_PATTERN = /^\s*<\/?[a-z][^>]*>\s*$/i;
const MARKDOWN_GROUP_HEADING_PATTERN = /^\s*##\s+Group\s+`[^`]+`\s*$/;
const MARKDOWN_GROUP_METADATA_PATTERN = /^\s*_range:\s*`[^`]*`_\s*$/;

export interface AnchorTreeNode {
  anchorId: string;
  line: string;
  children: AnchorTreeNode[];
}

export type AnchorInjectionMode = 'legacy' | 'positional';

function buildLegacyAnchorId(topLevelCounter: number, nestedCounter: number): string {
  return nestedCounter === 0 ? `O${topLevelCounter}` : `O${topLevelCounter}-N${nestedCounter}`;
}

function buildPositionalAnchorId(path: number[]): string {
  return `O${path.join('.')}`;
}

export function parseAnchorId(line: string): string | null {
  const trimmed = line.trimStart();
  return trimmed.match(POSITIONAL_ANCHOR_ID_PATTERN)?.[1] ?? trimmed.match(LEGACY_ANCHOR_ID_PATTERN)?.[1] ?? null;
}

export function parsePositionalId(id: string): string[] {
  const match = id.match(/^O(\d+(?:\.\d+)*)$/);
  if (!match) {
    return [];
  }

  const parts = match[1]!.split('.');
  return parts.map((_, index) => `O${parts.slice(0, index + 1).join('.')}`);
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

  if (XML_TAG_PATTERN.test(trimmed) && !trimmed.startsWith('<collapsed ') && trimmed !== '</collapsed>') {
    return false;
  }

  if (trimmed === '</collapsed>') {
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

function injectLegacyAnchorIds(observations: string): string {
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

    const anchorId = buildLegacyAnchorId(topLevelCounter, nestedCounter);
    const leadingWhitespace = line.match(/^\s*/)?.[0] ?? '';
    lines[i] = `${leadingWhitespace}[${anchorId}] ${line.slice(leadingWhitespace.length)}`;
    changed = true;
  }

  return changed ? lines.join('\n') : observations;
}

function injectPositionalAnchorIds(observations: string): string {
  const lines = observations.split('\n');
  const pathCounters: number[] = [];
  let collapsedDepth = 0;
  let changed = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const trimmed = line.trim();

    if (trimmed === '</collapsed>') {
      collapsedDepth = Math.max(0, collapsedDepth - 1);
      continue;
    }

    if (!shouldAnchorLine(line)) {
      continue;
    }

    const indentationDepth = getIndentationDepth(line);
    const depth = indentationDepth + collapsedDepth;
    const nextCount = (pathCounters[depth] ?? 0) + 1;
    pathCounters[depth] = nextCount;
    pathCounters.length = depth + 1;

    const path = pathCounters.slice(0, depth + 1);
    const anchorId = buildPositionalAnchorId(path);
    const leadingWhitespace = line.match(/^\s*/)?.[0] ?? '';
    lines[i] = `${leadingWhitespace}[${anchorId}] ${line.slice(leadingWhitespace.length)}`;
    changed = true;

    if (trimmed.startsWith('<collapsed ')) {
      collapsedDepth += 1;
    }
  }

  return changed ? lines.join('\n') : observations;
}

export function injectAnchorIds(observations: string, mode: AnchorInjectionMode = 'legacy'): string {
  if (!observations) {
    return observations;
  }

  return mode === 'positional' ? injectPositionalAnchorIds(observations) : injectLegacyAnchorIds(observations);
}

export function buildAnchorTree(observations: string): AnchorTreeNode[] {
  const lines = observations.split('\n');
  const root: AnchorTreeNode[] = [];
  const stack: Array<{ depth: number; node: AnchorTreeNode }> = [];

  for (const line of lines) {
    const anchorId = parseAnchorId(line);
    if (!anchorId) {
      continue;
    }

    const node: AnchorTreeNode = {
      anchorId,
      line,
      children: [],
    };

    const depth = Math.max(parsePositionalId(anchorId).length - 1, getIndentationDepth(line));

    while (stack.length > 0 && stack[stack.length - 1]!.depth >= depth) {
      stack.pop();
    }

    const parent = stack[stack.length - 1];
    if (parent) {
      parent.node.children.push(node);
    } else {
      root.push(node);
    }

    stack.push({ depth, node });
  }

  return root;
}

export function findNodeByAnchorId(tree: AnchorTreeNode[], id: string): AnchorTreeNode | null {
  const path = parsePositionalId(id);
  if (path.length === 0) {
    return null;
  }

  let nodes = tree;
  let current: AnchorTreeNode | null = null;

  for (const segment of path) {
    current = nodes.find(node => node.anchorId === segment) ?? null;
    if (!current) {
      return null;
    }
    nodes = current.children;
  }

  return current;
}

export function stripEphemeralAnchorIds(observations: string): string {
  if (!observations) {
    return observations;
  }

  return observations.replace(/(^|\n)([^\S\n]*)\[(O\d+(?:-N\d+|\.\d+)*)\][^\S\n]*/g, '$1$2');
}
