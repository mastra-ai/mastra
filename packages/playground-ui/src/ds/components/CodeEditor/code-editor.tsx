import { jsonLanguage } from '@codemirror/lang-json';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { languages } from '@codemirror/language-data';
import { EditorState } from '@codemirror/state';
import type { Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { tags as t } from '@lezer/highlight';
import { draculaInit } from '@uiw/codemirror-theme-dracula';
import CodeMirror from '@uiw/react-codemirror';
import type { ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { forwardRef, useMemo } from 'react';
import type { HTMLAttributes } from 'react';
import { createVariableAutocomplete } from './variable-autocomplete-extension';
import { variableHighlight } from './variable-highlight-extension';
import { CopyButton } from '@/ds/components/CopyButton';
import type { JsonSchema } from '@/lib/json-schema';
import { cn } from '@/lib/utils';
import { useIsDarkMode } from '@/store/playground-store';

export type CodeEditorLanguage = 'json' | 'markdown';

/** Original dark theme — draculaInit + custom overrides. Unchanged from before light mode work. */
function buildDarkTheme(): Extension {
  const baseTheme = draculaInit({
    settings: {
      fontFamily: 'var(--geist-mono)',
      fontSize: '0.8rem',
      lineHighlight: 'transparent',
      gutterBackground: 'transparent',
      gutterForeground: 'var(--neutral2)',
      background: 'transparent',
      foreground: 'var(--neutral6)',
      caret: 'var(--neutral6)',
    },
    styles: [
      { tag: [t.className, t.propertyName], color: 'var(--neutral6)' },
      { tag: t.heading, color: 'var(--accent3)', fontWeight: 'bold' },
      {
        tag: [t.heading1, t.heading2, t.heading3, t.heading4, t.heading5, t.heading6],
        color: 'var(--accent3)',
        fontWeight: 'bold',
      },
      { tag: t.emphasis, fontStyle: 'italic', color: 'var(--neutral6)' },
      { tag: t.strong, fontWeight: 'bold', color: 'var(--neutral6)' },
      { tag: t.link, color: 'var(--accent3)', textDecoration: 'underline' },
      { tag: t.url, color: 'var(--accent3)' },
      { tag: t.monospace, color: 'var(--neutral6)' },
      { tag: t.strikethrough, textDecoration: 'line-through' },
      { tag: t.quote, fontStyle: 'italic', color: 'var(--neutral2)' },
    ],
  });

  const customLineNumberTheme = EditorView.theme({
    '.cm-editor': {
      backgroundColor: 'transparent',
    },
    '.cm-content': {
      color: 'var(--neutral6)',
      caretColor: 'var(--neutral6)',
    },
    '.cm-lineNumbers .cm-gutterElement': {
      color: 'var(--neutral2)',
    },
    '.cm-activeLineGutter': {
      color: 'var(--neutral3)',
    },
    '.cm-cursor': {
      borderLeftColor: 'var(--neutral6)',
    },
    '.cm-selectionBackground, .cm-content ::selection': {
      backgroundColor: 'color-mix(in srgb, var(--accent3) 22%, transparent)',
    },
    '.cm-tooltip-autocomplete': {
      backgroundColor: 'var(--surface2)',
      border: '1px solid var(--border1)',
      borderRadius: '6px',
      boxShadow: '0 8px 16px rgba(0, 0, 0, 0.2)',
    },
    '.cm-tooltip-autocomplete > ul': {
      fontFamily: 'var(--geist-mono)',
    },
    '.cm-completionLabel': {
      color: 'var(--neutral6)',
    },
    '.cm-completionDetail': {
      color: 'var(--neutral3)',
      fontSize: '0.7rem',
      marginLeft: 'auto',
      paddingLeft: '12px',
    },
    '.cm-completionInfo': {
      backgroundColor: 'var(--surface2)',
      border: '1px solid var(--border1)',
      color: 'var(--neutral3)',
      padding: '8px 12px',
    },
    '.cm-completionIcon': {
      display: 'none',
    },
    'ul.cm-completionList li[aria-selected]': {
      backgroundColor: 'var(--surface4)',
      color: 'var(--neutral6)',
    },
    '.cm-line .cm-variable-highlight': {
      color: 'var(--accent6) !important',
      fontWeight: '500',
    },
  });

  return [baseTheme, customLineNumberTheme];
}

function buildLightTheme(): Extension {
  const editorTheme = EditorView.theme({
    '&': {
      backgroundColor: 'transparent',
      color: 'var(--neutral6)',
      fontSize: '0.8rem',
    },
    '&.cm-editor .cm-scroller': {
      fontFamily: 'var(--geist-mono)',
    },
    '.cm-gutters': {
      backgroundColor: 'transparent',
      color: 'var(--neutral2)',
      borderRight: 'none',
    },
    '.cm-content': {
      color: 'var(--neutral6)',
      caretColor: 'var(--neutral6)',
    },
    '.cm-activeLine': {
      backgroundColor: 'transparent',
    },
    '.cm-lineNumbers .cm-gutterElement': {
      color: 'var(--neutral2)',
    },
    '.cm-activeLineGutter': {
      backgroundColor: 'transparent',
      color: 'var(--neutral3)',
    },
    '.cm-cursor, .cm-dropCursor': {
      borderLeftColor: 'var(--neutral6)',
    },
    '&.cm-focused .cm-selectionBackground, & .cm-line::selection, & .cm-selectionLayer .cm-selectionBackground, .cm-content ::selection':
      {
        background: 'color-mix(in srgb, var(--accent3) 22%, transparent) !important',
      },
    '.cm-tooltip-autocomplete': {
      backgroundColor: 'var(--surface2)',
      border: '1px solid var(--border1)',
      borderRadius: '6px',
      boxShadow: '0 8px 16px rgba(0, 0, 0, 0.2)',
    },
    '.cm-tooltip-autocomplete > ul': {
      fontFamily: 'var(--geist-mono)',
    },
    '.cm-completionLabel': {
      color: 'var(--neutral6)',
    },
    '.cm-completionDetail': {
      color: 'var(--neutral3)',
      fontSize: '0.7rem',
      marginLeft: 'auto',
      paddingLeft: '12px',
    },
    '.cm-completionInfo': {
      backgroundColor: 'var(--surface2)',
      border: '1px solid var(--border1)',
      color: 'var(--neutral3)',
      padding: '8px 12px',
    },
    '.cm-completionIcon': {
      display: 'none',
    },
    'ul.cm-completionList li[aria-selected]': {
      backgroundColor: 'var(--surface4)',
      color: 'var(--neutral6)',
    },
    '.cm-line .cm-variable-highlight': {
      color: 'var(--accent6) !important',
      fontWeight: '500',
    },
  });

  const highlightStyle = HighlightStyle.define([
    { tag: [t.comment, t.bracket], color: 'var(--neutral2)' },
    { tag: [t.string, t.meta, t.regexp], color: 'var(--accent1)' },
    { tag: [t.atom, t.bool, t.special(t.variableName)], color: 'var(--accent6)' },
    { tag: [t.keyword, t.operator, t.tagName], color: 'var(--accent2)' },
    { tag: [t.function(t.propertyName), t.propertyName], color: 'var(--accent5)' },
    {
      tag: [t.definition(t.variableName), t.function(t.variableName), t.className, t.attributeName],
      color: 'var(--accent3)',
    },
    { tag: [t.variableName, t.number], color: 'var(--accent5)' },
    { tag: [t.name, t.quote], color: 'var(--accent1)' },
    { tag: t.heading, color: 'var(--accent3)', fontWeight: 'bold' },
    {
      tag: [t.heading1, t.heading2, t.heading3, t.heading4, t.heading5, t.heading6],
      color: 'var(--accent3)',
      fontWeight: 'bold',
    },
    { tag: [t.emphasis], fontStyle: 'italic', color: 'var(--neutral6)' },
    { tag: [t.strong], fontWeight: 'bold', color: 'var(--neutral6)' },
    { tag: t.link, color: 'var(--accent3)', textDecoration: 'underline' },
    { tag: t.url, color: 'var(--accent3)' },
    { tag: t.monospace, color: 'var(--neutral6)' },
    { tag: t.strikethrough, textDecoration: 'line-through' },
    { tag: [t.deleted], color: 'var(--accent2)' },
    { tag: t.invalid, color: 'var(--error)' },
    { tag: [t.standard(t.tagName)], color: 'var(--accent1)' },
  ]);

  return [editorTheme, syntaxHighlighting(highlightStyle)];
}

export const useCodemirrorTheme = (): Extension => {
  const isDark = useIsDarkMode();
  return useMemo(() => (isDark ? buildDarkTheme() : buildLightTheme()), [isDark]);
};

export type CodeEditorProps = {
  data?: Record<string, unknown> | Array<Record<string, unknown>>;
  value?: string;
  onChange?: (value: string) => void;
  showCopyButton?: boolean;
  className?: string;
  highlightVariables?: boolean;
  language?: CodeEditorLanguage;
  placeholder?: string;
  /** JSON Schema to enable variable autocomplete for {{variable}} placeholders (markdown only) */
  schema?: JsonSchema;
  autoFocus?: boolean;
  /** Show line numbers in the gutter (default: true) */
  lineNumbers?: boolean;
  /** When false, makes the editor read-only */
  editable?: boolean;
} & Omit<HTMLAttributes<HTMLDivElement>, 'onChange'>;

export const CodeEditor = forwardRef<ReactCodeMirrorRef, CodeEditorProps>(
  (
    {
      data,
      value,
      onChange,
      showCopyButton = true,
      className,
      language = 'json',
      highlightVariables = false,
      placeholder,
      schema,
      autoFocus,
      lineNumbers = true,
      editable,
      ...props
    },
    ref,
  ) => {
    const theme = useCodemirrorTheme();
    const formattedCode = data ? JSON.stringify(data, null, 2) : (value ?? '');

    const extensions = useMemo(() => {
      const exts: Extension[] = [];

      if (language === 'json') {
        exts.push(jsonLanguage);
      } else if (language === 'markdown') {
        exts.push(markdown({ base: markdownLanguage, codeLanguages: languages }));
        exts.push(EditorView.lineWrapping);
      }

      if (highlightVariables && language === 'markdown') {
        exts.push(variableHighlight);
      }

      if (schema && language === 'markdown') {
        exts.push(createVariableAutocomplete(schema));
      }

      if (editable === false) {
        exts.push(EditorState.readOnly.of(true));
      }

      return exts;
    }, [language, highlightVariables, schema, editable]);

    return (
      <div
        className={cn('rounded-md bg-surface3 p-1 font-mono relative border border-border1 overflow-hidden', className)}
        {...props}
      >
        {showCopyButton && <CopyButton content={formattedCode} className="absolute top-2 right-2 z-20" />}
        <CodeMirror
          ref={ref}
          value={formattedCode}
          theme={theme}
          extensions={extensions}
          onChange={onChange}
          editable={editable}
          aria-label="Code editor"
          placeholder={placeholder}
          height="100%"
          style={{ height: '100%' }}
          autoFocus={autoFocus}
          basicSetup={{ lineNumbers }}
        />
      </div>
    );
  },
);

export async function highlight(code: string, language: string) {
  const { codeToTokens, bundledLanguages } = await import('shiki');

  if (!(language in bundledLanguages)) return null;

  const { tokens } = await codeToTokens(code, {
    lang: language as keyof typeof bundledLanguages,
    defaultColor: false,
    themes: {
      light: 'github-light',
      dark: 'github-dark',
    },
  });

  return tokens;
}
