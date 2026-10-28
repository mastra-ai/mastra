import { foldGutter } from '@codemirror/language';
import type { Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';

const foldTheme = EditorView.theme({
  '.cm-foldGutter .cm-gutterElement': {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 4px',
  },
  '.cm-fold-marker': {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '12px',
    height: '12px',
    boxSizing: 'border-box',
    border: '1px solid var(--border)',
    borderRadius: '2px',
    color: 'var(--muted-foreground)',
    fontSize: 'var(--text-caption)',
    lineHeight: '1',
    cursor: 'pointer',
    userSelect: 'none',
  },
  '.cm-fold-marker:hover': {
    background: 'var(--fill-hover)',
    color: 'var(--foreground)',
  },
  '.cm-foldPlaceholder': {
    background: 'var(--fill-hover)',
    border: '1px solid var(--border)',
    color: 'var(--muted-foreground)',
    borderRadius: '2px',
    padding: '0 4px',
    margin: '0 2px',
  },
});

/** Fold gutter with a square −/+ toggle next to each foldable line, styled with design tokens. */
export const codeFoldGutter: Extension = [
  foldGutter({
    markerDOM: open => {
      const marker = document.createElement('span');
      marker.className = 'cm-fold-marker';
      marker.dataset.state = open ? 'open' : 'closed';
      marker.title = open ? 'Fold' : 'Unfold';
      marker.textContent = open ? '−' : '+';
      return marker;
    },
  }),
  foldTheme,
];
