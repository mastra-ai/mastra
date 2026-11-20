import { StateEffect, StateField } from '@codemirror/state';
import type { EditorState, Extension } from '@codemirror/state';
import { EditorView, showTooltip } from '@codemirror/view';
import type { Tooltip, TooltipView } from '@codemirror/view';

type SelectionToolbarSnapshot = { host: HTMLElement; view: EditorView; state: EditorState } | null;

export type SelectionToolbar = {
  extension: Extension;
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => SelectionToolbarSnapshot;
};

const setFocused = StateEffect.define<boolean>();

const focused = StateField.define<boolean>({
  create: () => false,
  update: (value, transaction) =>
    transaction.effects.reduce((current, effect) => (effect.is(setFocused) ? effect.value : current), value),
});

const hostTheme = EditorView.theme({
  '.cm-tooltip.cm-md-toolbar': { border: 'none', backgroundColor: 'transparent' },
});

export function createSelectionToolbar(): SelectionToolbar {
  let snapshot: SelectionToolbarSnapshot = null;
  const listeners = new Set<() => void>();
  const publish = (next: SelectionToolbarSnapshot) => {
    snapshot = next;
    for (const listener of listeners) listener();
  };

  const create = (view: EditorView): TooltipView => {
    const host = document.createElement('div');
    host.className = 'cm-md-toolbar';
    return {
      dom: host,
      offset: { x: 0, y: 6 },
      mount: () => publish({ host, view, state: view.state }),
      update: update => {
        if (update.docChanged || update.selectionSet) publish({ host, view, state: update.state });
      },
      destroy: () => publish(null),
    };
  };

  const tooltipFor = (state: EditorState, previous: Tooltip | null): Tooltip | null => {
    const { from, to, empty } = state.selection.main;
    if (empty || state.readOnly || !state.field(focused)) return null;
    if (previous?.pos === from && previous.end === to) return previous;
    return { pos: from, end: to, above: true, arrow: false, create };
  };

  const tooltip = StateField.define<Tooltip | null>({
    create: state => tooltipFor(state, null),
    update: (previous, transaction) => tooltipFor(transaction.state, previous),
    provide: field => showTooltip.from(field),
  });

  return {
    extension: [
      focused,
      EditorView.focusChangeEffect.of((_state, focusing) => setFocused.of(focusing)),
      tooltip,
      hostTheme,
    ],
    subscribe: listener => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => snapshot,
  };
}
