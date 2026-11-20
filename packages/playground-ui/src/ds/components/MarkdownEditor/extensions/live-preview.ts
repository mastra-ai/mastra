import { syntaxTree } from '@codemirror/language';
import type { EditorState, Range, SelectionRange } from '@codemirror/state';
import { Decoration, ViewPlugin, WidgetType } from '@codemirror/view';
import type { DecorationSet, EditorView, ViewUpdate } from '@codemirror/view';
import type { SyntaxNode } from '@lezer/common';

type Span = { from: number; to: number };

class BulletWidget extends WidgetType {
  eq() {
    return true;
  }

  toDOM() {
    const bullet = document.createElement('span');
    bullet.className = 'cm-md-bullet';
    // oxlint-disable-next-line playground-ui/no-text-separators -- a list bullet, not a separator between fields
    bullet.textContent = '•';
    return bullet;
  }
}

const hiddenMark = Decoration.replace({});
const bulletMark = Decoration.replace({ widget: new BulletWidget() });
const lineDecorations = new Map<string, Decoration>();

const lineDecoration = (className: string) => {
  let decoration = lineDecorations.get(className);
  if (!decoration) {
    decoration = Decoration.line({ class: className });
    lineDecorations.set(className, decoration);
  }
  return decoration;
};

const inlineMarkParents: Record<string, readonly string[]> = {
  EmphasisMark: ['Emphasis', 'StrongEmphasis'],
  StrikethroughMark: ['Strikethrough'],
  CodeMark: ['InlineCode'],
};

const touches = (selection: readonly SelectionRange[], scope: Span) =>
  selection.some(range => range.from <= scope.to && range.to >= scope.from);

const leadingBlanks = (text: string) => text.length - text.trimStart().length;

function headerMarkSpan(state: EditorState, mark: SyntaxNode, heading: SyntaxNode): Span {
  const line = state.doc.lineAt(mark.from);
  if (mark.from === heading.from) {
    return { from: mark.from, to: mark.to + leadingBlanks(state.sliceDoc(mark.to, line.to)) };
  }
  const before = state.sliceDoc(line.from, mark.from);
  return { from: mark.from - (before.length - before.trimEnd().length), to: mark.to };
}

function previewDecorations(view: EditorView): DecorationSet {
  const { state } = view;
  const selection = view.hasFocus ? state.selection.ranges : [];
  const decorations: Range<Decoration>[] = [];
  const lineClasses = new Map<number, Set<string>>();

  const addLineClass = (lineStart: number, className: string) => {
    const classes = lineClasses.get(lineStart) ?? new Set<string>();
    classes.add(className);
    lineClasses.set(lineStart, classes);
  };

  const decorateLines = (block: Span, visible: Span, className: string) => {
    const first = state.doc.lineAt(Math.max(block.from, visible.from));
    const last = state.doc.lineAt(Math.min(block.to, visible.to));
    for (let number = first.number; number <= last.number; number++) {
      addLineClass(state.doc.line(number).from, className);
    }
  };

  const hideUnlessTouched = (span: Span, scope: Span, decoration = hiddenMark) => {
    if (!touches(selection, scope)) decorations.push(decoration.range(span.from, span.to));
  };

  for (const visible of view.visibleRanges) {
    syntaxTree(state).iterate({
      from: visible.from,
      to: visible.to,
      enter: ref => {
        const { name } = ref;
        if (name === 'FencedCode') {
          decorateLines(ref, visible, 'cm-md-fence-line');
          if (ref.from >= visible.from) addLineClass(state.doc.lineAt(ref.from).from, 'cm-md-fence-start');
          if (ref.to <= visible.to) addLineClass(state.doc.lineAt(ref.to).from, 'cm-md-fence-end');
          return false;
        }
        if (name === 'Blockquote') {
          decorateLines(ref, visible, 'cm-md-quote-line');
          return;
        }
        const node = ref.node;
        if (name === 'Link') {
          const [open, close] = node.getChildren('LinkMark');
          if (open && close && node.getChild('URL') && state.doc.lineAt(close.from).to >= ref.to) {
            hideUnlessTouched(open, ref);
            hideUnlessTouched({ from: close.from, to: ref.to }, ref);
          }
          return;
        }
        const line = state.doc.lineAt(ref.from);
        if (name === 'HorizontalRule') {
          if (!touches(selection, line)) {
            decorations.push(hiddenMark.range(ref.from, ref.to));
            addLineClass(line.from, 'cm-md-rule-line');
          }
          return;
        }
        const parent = node.parent;
        if (!parent) return;
        if (name === 'HeaderMark' && parent.name.startsWith('ATXHeading')) {
          hideUnlessTouched(headerMarkSpan(state, node, parent), line);
        } else if (name === 'QuoteMark') {
          const blank = Math.min(1, leadingBlanks(state.sliceDoc(ref.to, line.to)));
          hideUnlessTouched({ from: ref.from, to: ref.to + blank }, line);
        } else if (name === 'ListMark' && parent.parent?.name === 'BulletList') {
          hideUnlessTouched(ref, line, bulletMark);
        } else if (inlineMarkParents[name]?.includes(parent.name)) {
          hideUnlessTouched(ref, parent);
        }
      },
    });
  }

  for (const [lineStart, classes] of lineClasses) {
    decorations.push(lineDecoration([...classes].join(' ')).range(lineStart));
  }
  return Decoration.set(decorations, true);
}

export const livePreview = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = previewDecorations(view);
    }

    update(update: ViewUpdate) {
      const treeChanged = syntaxTree(update.startState) !== syntaxTree(update.state);
      if (update.docChanged || update.selectionSet || update.focusChanged || update.viewportChanged || treeChanged) {
        this.decorations = previewDecorations(update.view);
      }
    }
  },
  { decorations: plugin => plugin.decorations },
);
