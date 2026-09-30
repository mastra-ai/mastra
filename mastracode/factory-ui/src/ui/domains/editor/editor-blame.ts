/**
 * CodeMirror gutter that renders per-line git blame. Author name and commit
 * short-hash sit in the gutter; agent-authored lines get an accent stripe so
 * reviewers can see at a glance which lines the agent wrote.
 *
 * The extension is a StateField + gutter pair so blame data can be pushed from
 * React without remounting the editor: dispatching `setBlameData` swaps the
 * data and repaints the gutter + highlight in one transaction.
 */

import { RangeSetBuilder, StateEffect, StateField } from '@codemirror/state';
import type { Extension } from '@codemirror/state';
import { Decoration, EditorView, GutterMarker, ViewPlugin, gutter } from '@codemirror/view';
import type { DecorationSet, ViewUpdate } from '@codemirror/view';

import type { BlameLine } from '../../../api/types';

export const setBlameData = StateEffect.define<BlameLine[] | null>();

class BlameGutterMarker extends GutterMarker {
  constructor(private readonly entry: BlameLine) {
    super();
  }

  override eq(other: GutterMarker): boolean {
    return (
      other instanceof BlameGutterMarker &&
      other.entry.sha === this.entry.sha &&
      other.entry.author === this.entry.author &&
      other.entry.agent === this.entry.agent
    );
  }

  override toDOM(): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = `cm-blame-line${this.entry.agent ? ' cm-blame-line-agent' : ''}${this.entry.uncommitted ? ' cm-blame-line-uncommitted' : ''}`;
    const author = document.createElement('span');
    author.className = 'cm-blame-author';
    author.textContent = this.entry.uncommitted ? 'Not committed' : this.entry.author || 'Unknown';
    const sha = document.createElement('span');
    sha.className = 'cm-blame-sha';
    sha.textContent = this.entry.uncommitted ? '' : this.entry.sha.slice(0, 7);
    wrapper.append(author, sha);
    const tooltip = [
      this.entry.uncommitted ? 'Uncommitted change' : `${this.entry.sha.slice(0, 12)} · ${this.entry.author}`,
      this.entry.email ? `<${this.entry.email}>` : '',
      this.entry.time || '',
      this.entry.summary || '',
    ]
      .filter(Boolean)
      .join('\n');
    wrapper.title = tooltip;
    return wrapper;
  }
}

interface BlameFieldValue {
  byLine: Map<number, BlameLine>;
  agentLines: number[];
}

const blameField = StateField.define<BlameFieldValue>({
  create: () => ({ byLine: new Map(), agentLines: [] }),
  update(value, tr) {
    let next = value;
    for (const effect of tr.effects) {
      if (effect.is(setBlameData)) {
        const byLine = new Map<number, BlameLine>();
        const agentLines: number[] = [];
        for (const entry of effect.value ?? []) {
          byLine.set(entry.line, entry);
          if (entry.agent) agentLines.push(entry.line);
        }
        next = { byLine, agentLines };
      }
    }
    return next;
  },
});

const placeholderEntry: BlameLine = {
  line: 0,
  sha: '00000000',
  author: 'placeholder',
  email: '',
  time: '',
  summary: '',
  uncommitted: false,
  agent: false,
};

function blameGutter(): Extension {
  return gutter({
    class: 'cm-blame-gutter',
    lineMarker(view, line) {
      const state = view.state.field(blameField, false);
      if (!state) return null;
      const lineInfo = view.state.doc.lineAt(line.from);
      const entry = state.byLine.get(lineInfo.number);
      return entry ? new BlameGutterMarker(entry) : null;
    },
    initialSpacer: () => new BlameGutterMarker(placeholderEntry),
  });
}

function computeAgentDecorations(view: EditorView): DecorationSet {
  const state = view.state.field(blameField, false);
  if (!state || state.agentLines.length === 0) return Decoration.none;
  const builder = new RangeSetBuilder<Decoration>();
  const doc = view.state.doc;
  for (const line of state.agentLines) {
    if (line < 1 || line > doc.lines) continue;
    const info = doc.line(line);
    builder.add(info.from, info.from, Decoration.line({ attributes: { class: 'cm-blame-agent-line' } }));
  }
  return builder.finish();
}

const blameHighlightPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = computeAgentDecorations(view);
    }
    update(update: ViewUpdate) {
      const hadEffect = update.transactions.some(tr => tr.effects.some(e => e.is(setBlameData)));
      if (hadEffect || update.docChanged) {
        this.decorations = computeAgentDecorations(update.view);
      }
    }
  },
  {
    decorations: v => v.decorations,
  },
);

export function blameExtension(): Extension {
  return [blameField, blameGutter(), blameHighlightPlugin];
}
