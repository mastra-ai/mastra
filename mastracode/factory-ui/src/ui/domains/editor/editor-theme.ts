import { syntaxHighlighting } from '@codemirror/language';
import type { Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';

import { editorHighlighter } from './editor-highlight';
import './editor-syntax.css';

/**
 * CodeMirror theme built entirely from design-system CSS variables so the
 * editor flips with `html.light` like every other surface — no per-theme
 * extension swap needed. Chrome colors come from the semantic layer
 * (`--foreground`, `--border`, `--fill-*`); syntax colors come from the
 * shared `.tok-*` palette in editor-syntax.css via `editorHighlighter`, the
 * same one used by search previews and hover signatures.
 */
const chrome = EditorView.theme({
  '&': {
    height: '100%',
    backgroundColor: 'transparent',
    color: 'var(--foreground)',
    fontSize: 'var(--text-body-sm)',
  },
  '&.cm-editor.cm-focused': {
    outline: 'none',
  },
  '&.cm-editor .cm-scroller': {
    fontFamily: 'var(--font-mono)',
    lineHeight: '1.6',
  },
  '.cm-content': {
    caretColor: 'var(--foreground)',
    paddingBlock: 'var(--spacing-2, 0.5rem)',
  },
  '.cm-cursor': {
    borderLeftColor: 'var(--foreground)',
  },
  '.cm-gutters': {
    backgroundColor: 'transparent',
    color: 'var(--placeholder)',
    border: 'none',
    paddingInlineStart: 'var(--spacing-1, 0.25rem)',
  },
  '.cm-lineNumbers .cm-gutterElement': {
    color: 'var(--placeholder)',
    minWidth: '3ch',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'transparent',
    color: 'var(--muted-foreground)',
  },
  '.cm-activeLine': {
    backgroundColor: 'var(--fill-subtle)',
  },
  '.cm-selectionBackground, .cm-content ::selection': {
    backgroundColor: 'color-mix(in srgb, var(--accent3) 24%, transparent)',
  },
  '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground': {
    backgroundColor: 'color-mix(in srgb, var(--accent3) 24%, transparent)',
  },
  '.cm-matchingBracket': {
    backgroundColor: 'var(--fill-hover)',
    outline: '1px solid var(--border-strong)',
  },
  '.cm-foldGutter .cm-gutterElement': {
    color: 'var(--muted-foreground)',
  },
  '.cm-panels': {
    backgroundColor: 'var(--card)',
    color: 'var(--foreground)',
    borderBlock: '1px solid var(--border)',
  },
  '.cm-panels input': {
    backgroundColor: 'var(--field)',
    color: 'var(--foreground)',
    border: '1px solid var(--border)',
    borderRadius: '4px',
  },
  '.cm-panels button': {
    color: 'var(--muted-foreground)',
  },
  '.cm-searchMatch': {
    backgroundColor: 'color-mix(in srgb, var(--accent6) 30%, transparent)',
  },
  '.cm-searchMatch-selected': {
    backgroundColor: 'color-mix(in srgb, var(--accent6) 55%, transparent)',
  },
  '.cm-tooltip': {
    backgroundColor: 'var(--popover)',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    color: 'var(--foreground)',
  },
  // Remote collaborator carets + name labels (y-codemirror.next). The plugin
  // sets the per-user colors inline; we own shape, typography, and layering.
  '.cm-ySelectionCaret': {
    position: 'relative',
    borderLeft: '1px solid',
    borderRight: '1px solid',
    marginLeft: '-1px',
    marginRight: '-1px',
    boxSizing: 'border-box',
  },
  '.cm-ySelectionInfo': {
    position: 'absolute',
    top: '-1.35em',
    left: '-1px',
    padding: '0 4px',
    borderRadius: '4px 4px 4px 0',
    fontFamily: 'var(--font-sans)',
    fontSize: '0.625rem',
    fontStyle: 'normal',
    fontWeight: '600',
    lineHeight: 'normal',
    whiteSpace: 'nowrap',
    userSelect: 'none',
    color: 'white',
    zIndex: '20',
  },
  // Autocomplete dropdown.
  '.cm-tooltip-autocomplete > ul > li': {
    fontFamily: 'var(--font-mono)',
    fontSize: 'var(--text-caption)',
    color: 'var(--muted-foreground)',
    padding: '2px 8px',
  },
  '.cm-tooltip-autocomplete > ul > li[aria-selected]': {
    backgroundColor: 'var(--fill)',
    color: 'var(--foreground)',
  },
  '.cm-completionMatchedText': {
    textDecoration: 'none',
    color: 'var(--accent3)',
  },
  '.cm-completionIcon': {
    color: 'var(--placeholder)',
  },
  // LSP diagnostics: lint tooltips + gutter markers themed with tokens.
  '.cm-tooltip-lint': {
    backgroundColor: 'var(--popover)',
    border: '1px solid var(--border)',
    borderRadius: '0.375rem',
    overflow: 'hidden',
  },
  '.cm-diagnostic': {
    padding: '0.25rem 0.5rem',
    fontFamily: 'var(--font-sans, sans-serif)',
    fontSize: 'var(--text-caption)',
    color: 'var(--foreground)',
    whiteSpace: 'pre-wrap',
  },
  '.cm-diagnostic-error': { borderLeft: '3px solid var(--notice-destructive)' },
  '.cm-diagnostic-warning': { borderLeft: '3px solid var(--notice-warning)' },
  '.cm-diagnostic-info': { borderLeft: '3px solid var(--notice-info)' },
  '.cm-diagnostic-hint': { borderLeft: '3px solid var(--muted-foreground)' },
  '.cm-diagnosticSource': {
    color: 'var(--muted-foreground)',
    fontSize: '0.9em',
  },
  '.cm-lint-marker-error': {
    content: 'none',
    width: '0.5rem',
    height: '0.5rem',
    borderRadius: '9999px',
    backgroundColor: 'var(--notice-destructive)',
  },
  '.cm-lint-marker-warning': {
    content: 'none',
    width: '0.5rem',
    height: '0.5rem',
    borderRadius: '9999px',
    backgroundColor: 'var(--notice-warning)',
  },
  '.cm-gutter-lint .cm-gutterElement': {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0',
  },
  // Agent code lenses: a quiet action row above each symbol.
  '.cm-code-lens': {
    display: 'flex',
    gap: '0.75rem',
    padding: '0.125rem 0 0.125rem 0.25rem',
    fontSize: '0.6875rem',
    lineHeight: '1.2',
  },
  '.cm-code-lens-action': {
    color: 'var(--placeholder)',
    background: 'transparent',
    border: 'none',
    padding: '0',
    cursor: 'pointer',
    font: 'inherit',
  },
  '.cm-code-lens-action:hover': {
    color: 'var(--foreground)',
    textDecoration: 'underline',
  },
  // Git blame gutter: quiet author + short-sha per line.
  '.cm-blame-gutter': {
    backgroundColor: 'var(--fill-subtle)',
    borderRight: '1px solid var(--border)',
    minWidth: '14rem',
  },
  '.cm-blame-line': {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0 0.5rem',
    fontFamily: 'var(--font-mono)',
    fontSize: '0.6875rem',
    color: 'var(--muted-foreground)',
    lineHeight: '1.5',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
  },
  '.cm-blame-line-agent': {
    color: 'var(--foreground)',
    borderLeft: '2px solid color-mix(in oklab, var(--accent3) 60%, transparent)',
    paddingLeft: 'calc(0.5rem - 2px)',
  },
  '.cm-blame-line-uncommitted': {
    fontStyle: 'italic',
    color: 'color-mix(in oklab, var(--notice-warning) 70%, var(--muted-foreground))',
  },
  '.cm-blame-author': {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '8rem',
  },
  '.cm-blame-sha': {
    opacity: '0.75',
    letterSpacing: '0.02em',
  },
  '.cm-blame-agent-line': {
    backgroundColor: 'color-mix(in oklab, var(--accent3) 8%, transparent)',
  },
  // LSP hover tooltip: signature code block + prose docs.
  '.cm-lsp-hover': {
    maxWidth: '40rem',
    maxHeight: '20rem',
    overflow: 'auto',
    padding: '0.5rem 0.625rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.375rem',
  },
  '.cm-lsp-hover-code': {
    margin: '0',
    padding: '0.375rem 0.5rem',
    backgroundColor: 'var(--fill-subtle)',
    border: '1px solid var(--border)',
    borderRadius: '4px',
    fontFamily: 'var(--font-mono)',
    fontSize: 'var(--text-caption)',
    whiteSpace: 'pre-wrap',
    color: 'var(--foreground)',
  },
  '.cm-lsp-hover-prose': {
    fontFamily: 'var(--font-sans, inherit)',
    fontSize: 'var(--text-caption)',
    lineHeight: '1.5',
    color: 'var(--muted-foreground)',
    whiteSpace: 'pre-wrap',
  },
  // @codemirror/merge unified diff: added lines in the buffer, deleted chunks
  // rendered inline from the original. Same success/destructive tints as the
  // workspace-viewer diff so both diff surfaces read identically.
  '.cm-changedLine': {
    backgroundColor: 'color-mix(in srgb, var(--notice-success) 10%, transparent)',
  },
  '.cm-changedText': {
    background: 'color-mix(in srgb, var(--notice-success) 22%, transparent)',
    backgroundImage: 'none',
  },
  '.cm-deletedChunk': {
    backgroundColor: 'color-mix(in srgb, var(--notice-destructive) 10%, transparent)',
  },
  '.cm-deletedChunk .cm-deletedText': {
    background: 'color-mix(in srgb, var(--notice-destructive) 24%, transparent)',
    backgroundImage: 'none',
    textDecoration: 'none',
  },
  '.cm-changeGutter .cm-changedLineGutter': {
    background: 'var(--notice-success)',
  },
  '.cm-changeGutter .cm-deletedLineGutter': {
    background: 'var(--notice-destructive)',
  },
});

export const editorTheme: Extension = [chrome, syntaxHighlighting(editorHighlighter)];
