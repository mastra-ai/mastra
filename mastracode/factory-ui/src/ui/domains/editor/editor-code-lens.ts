import { StateEffect, StateField } from '@codemirror/state';
import { Decoration, EditorView, WidgetType, type DecorationSet } from '@codemirror/view';

/**
 * Agent code lenses: a subtle action row rendered above each symbol that
 * pre-fills the send-to-agent composer with the symbol's source and a task.
 */

export type CodeLensAction = 'explain' | 'refactor' | 'tests';

export interface CodeLensEntry {
  /** 1-indexed line the symbol starts on. */
  line: number;
  /** 1-indexed line the symbol ends on. */
  endLine: number;
  name: string;
  kind: string;
}

export type CodeLensActionHandler = (action: CodeLensAction, entry: CodeLensEntry) => void;

export const setCodeLenses = StateEffect.define<CodeLensEntry[]>();

const LENS_ACTIONS: readonly { action: CodeLensAction; label: string }[] = [
  { action: 'explain', label: 'Explain' },
  { action: 'refactor', label: 'Refactor' },
  { action: 'tests', label: 'Add tests' },
];

class CodeLensWidget extends WidgetType {
  constructor(
    private readonly entry: CodeLensEntry,
    private readonly onAction: CodeLensActionHandler,
  ) {
    super();
  }

  override eq(other: CodeLensWidget) {
    return (
      other.entry.name === this.entry.name &&
      other.entry.line === this.entry.line &&
      other.entry.endLine === this.entry.endLine
    );
  }

  override toDOM() {
    const row = document.createElement('div');
    row.className = 'cm-code-lens';
    for (const { action, label } of LENS_ACTIONS) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'cm-code-lens-action';
      button.textContent = label;
      // Keep editor focus/selection intact — the widget handles its own click.
      button.addEventListener('mousedown', event => event.preventDefault());
      button.addEventListener('click', () => this.onAction(action, this.entry));
      row.appendChild(button);
    }
    return row;
  }

  override ignoreEvent() {
    return true;
  }
}

/**
 * Extension holding the current lens set. Dispatch `setCodeLenses` to update;
 * the action handler is read through `getHandler` so the host can swap
 * callbacks without reconfiguring the editor.
 */
export function codeLensExtension(getHandler: () => CodeLensActionHandler | null) {
  const handle: CodeLensActionHandler = (action, entry) => getHandler()?.(action, entry);
  return StateField.define<DecorationSet>({
    create: () => Decoration.none,
    update(value, tr) {
      value = value.map(tr.changes);
      for (const effect of tr.effects) {
        if (effect.is(setCodeLenses)) {
          const widgets = [];
          for (const entry of effect.value) {
            if (entry.line < 1 || entry.line > tr.state.doc.lines) continue;
            const pos = tr.state.doc.line(entry.line).from;
            widgets.push(
              Decoration.widget({ widget: new CodeLensWidget(entry, handle), side: -1, block: true }).range(pos),
            );
          }
          value = Decoration.set(widgets, true);
        }
      }
      return value;
    },
    provide: field => EditorView.decorations.from(field),
  });
}
