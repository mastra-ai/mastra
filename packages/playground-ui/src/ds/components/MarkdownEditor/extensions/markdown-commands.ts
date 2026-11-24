import { syntaxTree } from '@codemirror/language';
import { EditorSelection, Prec } from '@codemirror/state';
import type { ChangeSpec, EditorState, SelectionRange, StateCommand } from '@codemirror/state';
import { keymap } from '@codemirror/view';
import type { SyntaxNode } from '@lezer/common';

type Span = { from: number; to: number };
type InlineFormat = { node: string; marker: string };

const bold: InlineFormat = { node: 'StrongEmphasis', marker: '**' };
const italic: InlineFormat = { node: 'Emphasis', marker: '*' };
const code: InlineFormat = { node: 'InlineCode', marker: '`' };

const urlPattern = /^https?:\/\/\S+$/;
const blockPrefix = /^\s*(?:(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?|>\s?|#{1,6}\s+)*/;
const codeBlock = /^(?:FencedCode|CodeBlock)$/;
const proseBlock = /^(?:Paragraph|ATXHeading\d|SetextHeading\d|Task|TableCell)$/;
const sides: readonly (-1 | 1)[] = [1, -1];
const boldItalicRun = bold.marker.length + italic.marker.length;

function enclosingNode(state: EditorState, span: Span, name: string): SyntaxNode | null {
  const tree = syntaxTree(state);
  for (const side of sides) {
    for (let node: SyntaxNode | null = tree.resolveInner(span.from, side); node; node = node.parent) {
      if (node.name === name && node.from <= span.from && node.to >= span.to) return node;
    }
  }
  return null;
}

function closest(node: SyntaxNode, pattern: RegExp) {
  for (let current: SyntaxNode | null = node; current; current = current.parent) {
    if (pattern.test(current.name)) return current;
  }
  return null;
}

export const insideCodeBlock = (state: EditorState, pos: number) =>
  sides.some(side => closest(syntaxTree(state).resolveInner(pos, side), codeBlock) !== null);

const holdsProse = (state: EditorState, span: Span) => {
  const node = syntaxTree(state).resolveInner(span.from, 1);
  if (node.name === 'HeaderMark') return false;
  const block = closest(node, proseBlock);
  return block !== null && span.to <= block.to;
};

function textSegments(state: EditorState, range: SelectionRange): Span[] {
  const segments: Span[] = [];
  for (let pos = range.from; pos <= range.to;) {
    const line = state.doc.lineAt(pos);
    const prefixEnd = line.from + (blockPrefix.exec(line.text)?.[0].length ?? 0);
    const from = Math.max(range.from, prefixEnd);
    const to = Math.min(range.to, line.to);
    const text = state.sliceDoc(from, to);
    const trimmedFrom = from + text.length - text.trimStart().length;
    const trimmedTo = to - (text.length - text.trimEnd().length);
    const segment = { from: trimmedFrom, to: trimmedTo };
    if (trimmedFrom < trimmedTo && holdsProse(state, segment)) segments.push(segment);
    pos = line.to + 1;
  }
  return segments;
}

function formattedAtCaret(state: EditorState, pos: number, format: InlineFormat) {
  const node = enclosingNode(state, { from: pos, to: pos }, format.node);
  if (!node?.firstChild || !node.lastChild) return null;
  return pos >= node.firstChild.to && pos <= node.lastChild.from ? node : null;
}

function rangeIsFormatted(state: EditorState, range: SelectionRange, format: InlineFormat) {
  if (range.empty) return Boolean(formattedAtCaret(state, range.from, format));
  const segments = textSegments(state, range);
  return segments.length > 0 && segments.every(segment => enclosingNode(state, segment, format.node));
}

const markerChanges = (node: SyntaxNode): ChangeSpec[] =>
  node.firstChild && node.lastChild
    ? [
        { from: node.from, to: node.firstChild.to },
        { from: node.lastChild.from, to: node.to },
      ]
    : [];

function nodesWithin(state: EditorState, span: Span, name: string) {
  const nodes: SyntaxNode[] = [];
  syntaxTree(state).iterate({
    from: span.from,
    to: span.to,
    enter: ref => {
      if (ref.name === name && ref.to > span.from && ref.from < span.to) nodes.push(ref.node);
    },
  });
  return nodes;
}

function mapInward(state: EditorState, specs: ChangeSpec[], range: SelectionRange) {
  const changes = state.changes(specs);
  const from = changes.mapPos(range.from, 1);
  const to = Math.max(from, changes.mapPos(range.to, -1));
  return {
    changes,
    range: range.anchor === range.from ? EditorSelection.range(from, to) : EditorSelection.range(to, from),
  };
}

function markerRuns(state: EditorState, pos: number, char: string) {
  const line = state.doc.lineAt(pos);
  const offset = pos - line.from;
  let before = 0;
  while (line.text.charAt(offset - before - 1) === char) before++;
  let after = 0;
  while (line.text.charAt(offset + after) === char) after++;
  return { before, after };
}

function toggleAtCaret(state: EditorState, range: SelectionRange, format: InlineFormat, formatted: boolean) {
  const pos = range.from;
  if (insideCodeBlock(state, pos)) return { range };
  const node = formatted ? formattedAtCaret(state, pos, format) : null;
  if (node?.lastChild && pos === node.lastChild.from) return { range: EditorSelection.cursor(node.to) };
  if (node) return mapInward(state, markerChanges(node), range);
  const { marker } = format;
  const { before, after } = markerRuns(state, pos, marker.charAt(0));
  if (before === after && (before === marker.length || before === boldItalicRun)) {
    return {
      changes: { from: pos - marker.length, to: pos + marker.length },
      range: EditorSelection.cursor(pos - marker.length),
    };
  }
  return { changes: { from: pos, insert: marker + marker }, range: EditorSelection.cursor(pos + marker.length) };
}

function toggleSegments(state: EditorState, range: SelectionRange, format: InlineFormat, formatted: boolean) {
  const specs: ChangeSpec[] = [];
  for (const segment of textSegments(state, range)) {
    if (formatted) {
      const node = enclosingNode(state, segment, format.node);
      if (node) specs.push(...markerChanges(node));
      continue;
    }
    const overlapping = nodesWithin(state, segment, format.node);
    const from = Math.min(segment.from, ...overlapping.map(node => node.from));
    const to = Math.max(segment.to, ...overlapping.map(node => node.to));
    specs.push(
      ...overlapping.flatMap(markerChanges),
      { from, insert: format.marker },
      { from: to, insert: format.marker },
    );
  }
  return mapInward(state, specs, range);
}

const isFormatted = (state: EditorState, format: InlineFormat) =>
  state.selection.ranges.every(range => rangeIsFormatted(state, range, format));

const toggleInline =
  (format: InlineFormat): StateCommand =>
  ({ state, dispatch }) => {
    if (state.readOnly) return false;
    const formatted = isFormatted(state, format);
    const update = state.changeByRange(range =>
      range.empty ? toggleAtCaret(state, range, format, formatted) : toggleSegments(state, range, format, formatted),
    );
    dispatch(state.update(update, { scrollIntoView: true, userEvent: 'input.format' }));
    return true;
  };

const linkAround = (state: EditorState, range: SelectionRange) => {
  const node = enclosingNode(state, range, 'Link');
  return node?.getChild('URL') ? node : null;
};

const isLinked = (state: EditorState) => state.selection.ranges.every(range => linkAround(state, range));

function linkRange(state: EditorState, range: SelectionRange, linked: boolean) {
  if (linked) {
    const node = linkAround(state, range);
    const [open, close] = node?.getChildren('LinkMark') ?? [];
    if (!node || !open || !close) return { range };
    return mapInward(
      state,
      [
        { from: node.from, to: open.to },
        { from: close.from, to: node.to },
      ],
      range,
    );
  }
  if (insideCodeBlock(state, range.from)) return { range };
  if (state.doc.lineAt(range.from).number !== state.doc.lineAt(range.to).number) return { range };
  const text = state.sliceDoc(range.from, range.to);
  if (urlPattern.test(text)) {
    return {
      changes: { from: range.from, to: range.to, insert: `[](${text})` },
      range: EditorSelection.cursor(range.from + 1),
    };
  }
  if (range.empty)
    return { changes: { from: range.from, insert: '[]()' }, range: EditorSelection.cursor(range.from + 1) };
  return {
    changes: [
      { from: range.from, insert: '[' },
      { from: range.to, insert: ']()' },
    ],
    range: EditorSelection.cursor(range.to + 3),
  };
}

const toggleLink: StateCommand = ({ state, dispatch }) => {
  if (state.readOnly) return false;
  const linked = isLinked(state);
  dispatch(
    state.update(
      state.changeByRange(range => linkRange(state, range, linked)),
      { scrollIntoView: true, userEvent: 'input.format' },
    ),
  );
  return true;
};

export type FormattingAction = {
  id: 'bold' | 'italic' | 'code' | 'link';
  label: string;
  key: string;
  run: StateCommand;
  isActive: (state: EditorState) => boolean;
};

export const formattingActions: readonly FormattingAction[] = [
  { id: 'bold', label: 'Bold', key: 'b', run: toggleInline(bold), isActive: state => isFormatted(state, bold) },
  { id: 'italic', label: 'Italic', key: 'i', run: toggleInline(italic), isActive: state => isFormatted(state, italic) },
  { id: 'code', label: 'Code', key: 'e', run: toggleInline(code), isActive: state => isFormatted(state, code) },
  { id: 'link', label: 'Link', key: 'k', run: toggleLink, isActive: isLinked },
];

export const formattingKeymap = Prec.high(
  keymap.of(formattingActions.map(action => ({ key: `Mod-${action.key}`, run: action.run }))),
);
