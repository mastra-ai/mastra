import { syntaxHighlighting } from '@codemirror/language';
import { EditorView } from '@codemirror/view';
import { tagHighlighter, tags as t } from '@lezer/highlight';
import { syntaxTagStyles } from '@/ds/components/CodeEditor/highlight';
import '@/ds/components/MarkdownRenderer/markdown-renderer.css';

const proseHighlighter = tagHighlighter([
  ...syntaxTagStyles,
  { tag: t.heading1, class: 'cm-md-heading cm-md-h1' },
  { tag: t.heading2, class: 'cm-md-heading cm-md-h2' },
  { tag: t.heading3, class: 'cm-md-heading cm-md-h3' },
  { tag: [t.heading4, t.heading5, t.heading6], class: 'cm-md-heading' },
  { tag: t.strong, class: 'cm-md-strong' },
  { tag: t.emphasis, class: 'cm-md-emphasis' },
  { tag: t.strikethrough, class: 'cm-md-strike' },
  { tag: t.link, class: 'cm-md-link' },
  { tag: t.url, class: 'cm-md-url' },
  { tag: t.monospace, class: 'cm-md-code' },
  { tag: t.quote, class: 'cm-md-quote' },
  { tag: [t.processingInstruction, t.contentSeparator, t.labelName], class: 'cm-md-mark' },
]);

const proseTheme = EditorView.theme({
  '&.cm-editor': { fontSize: 'var(--text-body)' },
  '.cm-content': { lineHeight: 'var(--markdown-leading)' },
  '.cm-placeholder': { color: 'var(--placeholder)' },
  '.cm-md-link.cm-md-url, .cm-md-link.cm-md-mark': { color: 'var(--placeholder)', textDecoration: 'none' },
  '.cm-md-mark': { color: 'var(--placeholder)' },
  '.cm-md-bullet': { color: 'var(--muted-foreground)' },
  '.cm-line.cm-md-quote-line': {
    borderLeft: 'var(--markdown-quote-rule)',
    paddingLeft: 'var(--markdown-quote-inset)',
  },
  '.cm-line.cm-md-fence-line': {
    backgroundColor: 'var(--fill)',
    padding: '0 0.75em',
    fontFamily: 'var(--font-mono)',
    fontSize: '0.875em',
  },
  '.cm-line.cm-md-fence-start': { borderTopLeftRadius: '6px', borderTopRightRadius: '6px', paddingTop: '0.25em' },
  '.cm-line.cm-md-fence-end': {
    borderBottomLeftRadius: '6px',
    borderBottomRightRadius: '6px',
    paddingBottom: '0.25em',
  },
  '.cm-md-fence-line .cm-md-code': { backgroundColor: 'transparent', padding: '0', fontSize: 'inherit' },
  '.cm-line.cm-md-rule-line': {
    background: 'linear-gradient(var(--border), var(--border)) no-repeat center / 100% 1px',
  },
  '&.cm-editor .cm-tooltip.cm-tooltip-autocomplete > ul': {
    maxHeight: 'none',
    padding: '4px',
    fontFamily: 'var(--font-body)',
  },
  '&.cm-editor .cm-tooltip.cm-tooltip-autocomplete > ul > li': {
    display: 'flex',
    alignItems: 'baseline',
    borderRadius: '4px',
    padding: '4px 8px',
    lineHeight: '1.5',
  },
  '&.cm-editor .cm-completionDetail': { fontFamily: 'var(--font-mono)', fontStyle: 'normal' },
});

export const proseStyle = [
  EditorView.editorAttributes.of({ class: 'mastra-markdown-editor' }),
  syntaxHighlighting(proseHighlighter),
  proseTheme,
];
