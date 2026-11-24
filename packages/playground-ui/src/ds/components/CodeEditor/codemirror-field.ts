import { Prec } from '@codemirror/state';
import type { Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { useMemo } from 'react';
import type { AriaAttributes } from 'react';
import { useFieldControlAria } from '@/ds/components/Field/field-control-aria';

export type CodemirrorFont = 'body' | 'mono';

function buildChromeTheme(font: CodemirrorFont): Extension {
  return EditorView.theme({
    '&': {
      backgroundColor: 'transparent',
      color: 'var(--foreground)',
      fontSize: 'var(--text-body-sm)',
    },
    '&.cm-editor .cm-scroller': {
      fontFamily: `var(--font-${font})`,
    },
    '.cm-gutters': {
      backgroundColor: 'transparent',
      color: 'var(--placeholder)',
      borderRight: 'none',
    },
    '.cm-content': {
      color: 'var(--foreground)',
      caretColor: 'var(--foreground)',
    },
    '.cm-activeLine': {
      backgroundColor: 'transparent',
    },
    '.cm-lineNumbers .cm-gutterElement': {
      color: 'var(--placeholder)',
    },
    '.cm-activeLineGutter': {
      backgroundColor: 'transparent',
      color: 'var(--muted-foreground)',
    },
    '.cm-cursor, .cm-dropCursor': {
      borderLeftColor: 'var(--foreground)',
    },
    '&.cm-focused .cm-selectionBackground, & .cm-line::selection, & .cm-selectionLayer .cm-selectionBackground, .cm-content ::selection':
      {
        background: 'var(--info-edge) !important',
      },
    '.cm-tooltip-autocomplete': {
      backgroundColor: 'var(--background)',
      border: '1px solid var(--border)',
      borderRadius: '6px',
      boxShadow: 'var(--elevation-overlay)',
    },
    '.cm-tooltip.cm-tooltip-autocomplete > ul': {
      fontFamily: 'var(--font-mono)',
    },
    '.cm-completionLabel': {
      color: 'var(--foreground)',
    },
    '.cm-completionDetail': {
      color: 'var(--muted-foreground)',
      fontSize: 'var(--text-caption)',
      marginLeft: 'auto',
      paddingLeft: '12px',
    },
    '.cm-completionInfo': {
      backgroundColor: 'var(--background)',
      border: '1px solid var(--border)',
      color: 'var(--muted-foreground)',
      padding: '8px 12px',
    },
    '.cm-completionIcon': {
      display: 'none',
    },
    '.cm-tooltip.cm-tooltip-autocomplete ul li[aria-selected]': {
      backgroundColor: 'var(--fill-hover)',
      color: 'var(--foreground)',
    },
    '.cm-line .cm-variable-highlight': {
      color: 'var(--warning-foreground) !important',
      fontWeight: '500',
    },
  });
}

const chromeThemes: Record<CodemirrorFont, Extension> = {
  body: buildChromeTheme('body'),
  mono: buildChromeTheme('mono'),
};

export const codemirrorChrome = (font: CodemirrorFont) => chromeThemes[font];

export const editorFocusExtensions: Extension[] = [
  Prec.highest(EditorView.editorAttributes.of({ style: 'outline: none' })),
  Prec.highest(
    EditorView.theme({
      '&': { outline: 'none' },
      '&.cm-focused': { outline: 'none' },
      '.cm-scroller': { outline: 'none' },
      '.cm-content': { outline: 'none' },
      '.cm-content:focus': { outline: 'none' },
    }),
  ),
];

export const inlineFieldTheme = EditorView.theme({
  '.cm-content': { padding: '0', minHeight: '3lh' },
  '.cm-line': { padding: '0' },
});

type CodemirrorFieldAriaProps = {
  id?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: AriaAttributes['aria-invalid'];
};

type ContentAttributes = {
  'aria-label': string;
  class: string;
  id?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: string;
};

export function useCodemirrorFieldAttributes(props: CodemirrorFieldAriaProps, fallbackLabel: string) {
  const fieldAria = useFieldControlAria({ 'aria-label': props['aria-label'] });
  const ariaLabel = props['aria-label'] ?? fallbackLabel;
  const controlId = props.id ?? fieldAria.id;
  const ariaLabelledBy = props['aria-labelledby'] ?? fieldAria['aria-labelledby'];
  const ariaDescribedBy = props['aria-describedby'] ?? fieldAria['aria-describedby'];
  const ariaInvalid = props['aria-invalid'] ?? fieldAria['aria-invalid'];

  const contentAttributes = useMemo(() => {
    const attributes: ContentAttributes = { 'aria-label': ariaLabel, class: 'zoom-safe-text' };
    if (controlId) attributes.id = controlId;
    if (ariaLabelledBy) attributes['aria-labelledby'] = ariaLabelledBy;
    if (ariaDescribedBy) attributes['aria-describedby'] = ariaDescribedBy;
    if (ariaInvalid !== undefined) attributes['aria-invalid'] = String(ariaInvalid);
    return EditorView.contentAttributes.of(attributes);
  }, [ariaLabel, controlId, ariaLabelledBy, ariaDescribedBy, ariaInvalid]);

  return { ariaLabel, contentAttributes };
}
