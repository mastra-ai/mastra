import { injectAnchorIds, parseAnchorId, stripEphemeralAnchorIds } from './anchor-ids';
import { findCollapsedNodeById, wrapInCollapsed } from './collapsed-nodes';

export type Edit =
  | { type: 'combine'; id: string; anchorIds: string[]; summary: string }
  | { type: 'reword'; anchorId: string; text: string }
  | { type: 'nest'; anchorIds: string[]; into: string; position: 'start' | 'end' };

interface AnchoredLine {
  index: number;
  anchorId: string;
  indent: string;
  content: string;
  raw: string;
}

function getAnchoredLines(observations: string): AnchoredLine[] {
  return observations.split('\n').flatMap((raw, index) => {
    const trimmed = raw.trimStart();
    const anchorId = parseAnchorId(trimmed);
    if (!anchorId) {
      return [];
    }

    const indent = raw.match(/^\s*/)?.[0] ?? '';
    const content = trimmed.replace(/^\[(O\d+(?:-N\d+|\.\d+)*)\]\s*/, '');
    return [{ index, anchorId, indent, content, raw }];
  });
}

function parentPath(anchorId: string): string {
  const parts = anchorId.split('.');
  parts.pop();
  return parts.join('.');
}

function requireSiblingAnchorIds(anchorIds: string[]): void {
  if (anchorIds.length < 2) {
    throw new Error('combine requires at least two anchorIds');
  }

  const expectedParent = parentPath(anchorIds[0]!);
  if (anchorIds.some(id => parentPath(id) !== expectedParent)) {
    throw new Error('combine requires anchorIds to be siblings');
  }
}

function replaceSummaryAttribute(line: string, text: string): string {
  return line.replace(/summary="([^"]*)"/, `summary="${text}"`);
}

function applyCombine(observations: string, edit: Extract<Edit, { type: 'combine' }>): string {
  requireSiblingAnchorIds(edit.anchorIds);

  const anchored = getAnchoredLines(observations);
  const targets = edit.anchorIds
    .map(anchorId => anchored.find(line => line.anchorId === anchorId))
    .filter((line): line is AnchoredLine => Boolean(line));

  if (targets.length !== edit.anchorIds.length) {
    throw new Error('combine could not resolve all anchorIds');
  }

  const lines = observations.split('\n');
  const first = targets[0]!;
  const block = targets.map(target => `${target.indent}${target.content}`).join('\n');
  const collapsed = wrapInCollapsed(edit.id, edit.summary, block)
    .split('\n')
    .map(line => `${first.indent}${line}`);

  const removeIndexes = new Set(targets.map(target => target.index));
  const nextLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    if (i === first.index) {
      nextLines.push(...collapsed);
    }

    if (!removeIndexes.has(i)) {
      nextLines.push(lines[i]!);
    }
  }

  return nextLines.join('\n');
}

function applyReword(observations: string, edit: Extract<Edit, { type: 'reword' }>): string {
  const lines = observations.split('\n');
  const anchored = getAnchoredLines(observations);
  const target = anchored.find(line => line.anchorId === edit.anchorId);

  if (!target) {
    throw new Error(`reword could not resolve anchorId ${edit.anchorId}`);
  }

  if (target.content.startsWith('<collapsed ')) {
    lines[target.index] = replaceSummaryAttribute(lines[target.index]!, edit.text);
  } else {
    lines[target.index] = `${target.indent}${edit.text}`;
  }

  return lines.join('\n');
}

function applyNest(observations: string, edit: Extract<Edit, { type: 'nest' }>): string {
  const stripped = stripEphemeralAnchorIds(observations);
  const anchored = getAnchoredLines(observations);
  const targetLines = edit.anchorIds
    .map(anchorId => anchored.find(line => line.anchorId === anchorId))
    .filter((line): line is AnchoredLine => Boolean(line));

  if (targetLines.length !== edit.anchorIds.length) {
    throw new Error('nest could not resolve all anchorIds');
  }

  const collapsed = findCollapsedNodeById(stripped, edit.into);
  if (!collapsed) {
    throw new Error(`nest target ${edit.into} is not a collapsed node`);
  }

  const movedText = targetLines.map(line => `${line.indent}${line.content}`).join('\n');
  const nextChildren =
    edit.position === 'start' ? `${movedText}\n${collapsed.children}` : `${collapsed.children}\n${movedText}`;
  const oldBlock = wrapInCollapsed(edit.into, collapsed.summary, collapsed.children);
  const newBlock = wrapInCollapsed(edit.into, collapsed.summary, nextChildren);

  const strippedLines = stripped.split('\n');
  const removeIndexes = new Set(targetLines.map(line => line.index));
  const withoutMoved = strippedLines.filter((_, index) => !removeIndexes.has(index)).join('\n');

  return withoutMoved.replace(oldBlock, newBlock);
}

export function applyEdits(observations: string, edits: Edit[]): string {
  let next = injectAnchorIds(stripEphemeralAnchorIds(observations), 'positional');

  for (const edit of edits) {
    if (edit.type === 'combine') {
      next = applyCombine(next, edit);
    } else if (edit.type === 'reword') {
      next = applyReword(next, edit);
    } else if (edit.type === 'nest') {
      next = applyNest(next, edit);
    }

    next = injectAnchorIds(stripEphemeralAnchorIds(next), 'positional');
  }

  return stripEphemeralAnchorIds(next);
}
