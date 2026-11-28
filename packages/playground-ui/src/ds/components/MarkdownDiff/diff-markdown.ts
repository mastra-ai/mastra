import type { Parent, PhrasingContent, Root } from 'mdast';

const INS_OPEN = '\uE000';
const INS_CLOSE = '\uE001';
const DEL_OPEN = '\uE002';
const DEL_CLOSE = '\uE003';
const MARKERS = /[\uE000-\uE003]/g;
const MARKER_SPLIT = /([\uE000-\uE003])/;
const BLOCK_PREFIX = /^(?:\s*(?:[-*+]\s+(?:\[[ xX]\]\s+)?|\d+[.)]\s+|#{1,6}\s+|>\s?))*/;
const FENCE = /^\s*(?:```|~~~)/;

export interface MarkdownDiffResult {
  markdown: string;
  additions: number;
  deletions: number;
}

type Op = { kind: 'same' | 'add' | 'remove'; value: string };

function diffSequence(before: string[], after: string[]): Op[] {
  const width = after.length + 1;
  const lengths = new Uint32Array((before.length + 1) * width);
  const at = (i: number, j: number) => lengths[i * width + j] ?? 0;
  for (let i = before.length - 1; i >= 0; i--) {
    for (let j = after.length - 1; j >= 0; j--) {
      lengths[i * width + j] = before[i] === after[j] ? at(i + 1, j + 1) + 1 : Math.max(at(i + 1, j), at(i, j + 1));
    }
  }
  const ops: Op[] = [];
  let i = 0;
  let j = 0;
  while (i < before.length || j < after.length) {
    if (i < before.length && j < after.length && before[i] === after[j]) {
      ops.push({ kind: 'same', value: after[j] ?? '' });
      i++;
      j++;
    } else if (j >= after.length || (i < before.length && at(i + 1, j) >= at(i, j + 1))) {
      ops.push({ kind: 'remove', value: before[i++] ?? '' });
    } else {
      ops.push({ kind: 'add', value: after[j++] ?? '' });
    }
  }
  return ops;
}

function mark(text: string, open: string, close: string) {
  const start = text.length - text.trimStart().length;
  const end = text.trimEnd().length;
  if (start >= end) return text;
  return `${text.slice(0, start)}${open}${text.slice(start, end)}${close}${text.slice(end)}`;
}

function splitPrefix(line: string): [string, string] {
  const prefix = BLOCK_PREFIX.exec(line)?.[0] ?? '';
  return [prefix, line.slice(prefix.length)];
}

function runFor(op: Op, run: Op['kind']): Op['kind'] | undefined {
  if (op.kind === 'same' || op.value.trim()) return op.kind;
  if (run !== 'same') return run;
  if (op.kind === 'add') return 'same';
  return undefined;
}

function diffWords(before: string, after: string) {
  const tokens = (text: string) => text.match(/\s+|[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*|[^\s\p{L}\p{N}]/gu) ?? [];
  const ops = diffSequence(tokens(before), tokens(after));
  let line = '';
  let run: Op['kind'] = 'same';
  let buffer = '';
  const flush = () => {
    if (run === 'add') line += mark(buffer, INS_OPEN, INS_CLOSE);
    else if (run === 'remove') line += mark(buffer, DEL_OPEN, DEL_CLOSE);
    else line += buffer;
    buffer = '';
  };
  for (const op of ops) {
    const kind = runFor(op, run);
    if (kind === undefined) continue;
    if (kind !== run) {
      flush();
      if (run === 'remove' && kind === 'add' && !/\s$/.test(line)) line += ' ';
      run = kind;
    }
    buffer += op.value;
  }
  flush();
  return line;
}

function wholeLine(line: string, open: string, close: string) {
  const [prefix, rest] = splitPrefix(line);
  return prefix + mark(rest, open, close);
}

function groupChanges(ops: Op[]) {
  const groups: Array<{ same: string } | { removed: string[]; added: string[] }> = [];
  for (const op of ops) {
    const last = groups.at(-1);
    if (op.kind === 'same') groups.push({ same: op.value });
    else if (last && 'removed' in last) (op.kind === 'remove' ? last.removed : last.added).push(op.value);
    else groups.push(op.kind === 'remove' ? { removed: [op.value], added: [] } : { removed: [], added: [op.value] });
  }
  return groups;
}

export function diffMarkdown(before: string, after: string): MarkdownDiffResult {
  const lines: string[] = [];
  let additions = 0;
  let deletions = 0;
  let inFence = false;

  for (const group of groupChanges(diffSequence(before.split('\n'), after.split('\n')))) {
    if ('same' in group) {
      if (FENCE.test(group.same)) inFence = !inFence;
      lines.push(group.same);
      continue;
    }
    const { removed, added } = group;
    deletions += removed.filter(line => line.trim()).length;
    additions += added.filter(line => line.trim()).length;

    for (let k = 0; k < Math.max(removed.length, added.length); k++) {
      const was = removed[k];
      const now = added[k];
      if (inFence) {
        if (now !== undefined) lines.push(now);
      } else if (was !== undefined && now !== undefined && splitPrefix(was)[0] === splitPrefix(now)[0]) {
        const [prefix, wasText] = splitPrefix(was);
        lines.push(prefix + diffWords(wasText, splitPrefix(now)[1]));
      } else {
        if (was?.trim()) lines.push(wholeLine(was, DEL_OPEN, DEL_CLOSE));
        if (now !== undefined) lines.push(wholeLine(now, INS_OPEN, INS_CLOSE));
      }
      if (now !== undefined && FENCE.test(now)) inFence = !inFence;
    }
  }

  return { markdown: lines.join('\n'), additions, deletions };
}

function stripMarkers(node: Parent) {
  for (const child of node.children) {
    if (child.type === 'code' || child.type === 'inlineCode' || child.type === 'html') {
      child.value = child.value.replace(MARKERS, '');
    }
    if ('children' in child) stripMarkers(child);
  }
}

const PHRASING = new Set([
  'text',
  'emphasis',
  'strong',
  'delete',
  'inlineCode',
  'link',
  'linkReference',
  'image',
  'imageReference',
  'break',
  'html',
  'footnoteReference',
]);

function isPhrasing(node: Parent['children'][number]): node is PhrasingContent {
  return PHRASING.has(node.type);
}

function wrapMarked(node: Parent) {
  const out: Parent['children'] = [];
  let open: { kind: 'add' | 'remove'; children: PhrasingContent[] } | undefined;
  const close = () => {
    if (!open) return;
    out.push(
      open.kind === 'add'
        ? { type: 'emphasis', data: { hName: 'ins' }, children: open.children }
        : { type: 'delete', children: open.children },
    );
    open = undefined;
  };

  for (const child of node.children) {
    if (child.type !== 'text') {
      if ('children' in child) wrapMarked(child);
      if (open && isPhrasing(child)) open.children.push(child);
      else {
        close();
        out.push(child);
      }
      continue;
    }
    for (const piece of child.value.split(MARKER_SPLIT)) {
      if (piece === INS_OPEN || piece === DEL_OPEN) {
        close();
        open = { kind: piece === INS_OPEN ? 'add' : 'remove', children: [] };
      } else if (piece === INS_CLOSE || piece === DEL_CLOSE) {
        close();
      } else if (piece) {
        if (open) open.children.push({ type: 'text', value: piece });
        else out.push({ type: 'text', value: piece });
      }
    }
  }
  close();
  node.children = out;
}

export function remarkDiffMarks() {
  return (tree: Root) => {
    stripMarkers(tree);
    wrapMarked(tree);
  };
}
