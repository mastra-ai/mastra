import { jsonLanguage } from '@codemirror/lang-json';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { EditorView } from '@codemirror/view';
import { tags as t } from '@lezer/highlight';
import { draculaInit } from '@uiw/codemirror-theme-dracula';
import CodeMirror from '@uiw/react-codemirror';
import { HTMLAttributes, useMemo } from 'react';
import { cn } from '@/lib/utils';

import type { Extension } from '@codemirror/state';
import type { JsonSchema } from '@/lib/json-schema';

import { CopyButton } from '@/ds/components/CopyButton';
import { variableHighlight } from './variable-highlight-extension';
import { createVariableAutocomplete } from './variable-autocomplete-extension';

export type CodeEditorLanguage = 'json' | 'markdown';

export const useCodemirrorTheme = (): Extension => {
  return useMemo(() => {
    const baseTheme = draculaInit({
      settings: {
        fontFamily: 'var(--geist-mono)',
        fontSize: '0.8rem',
        lineHighlight: 'transparent',
        gutterBackground: 'transparent',
        gutterForeground: '#939393',
        background: 'transparent',
      },
      styles: [
        { tag: [t.className, t.propertyName] },
        // Markdown-specific styles using Dracula colors
        { tag: t.heading, color: '#ff79c6', fontWeight: 'bold' },
        {
          tag: [t.heading1, t.heading2, t.heading3, t.heading4, t.heading5, t.heading6],
          color: '#ff79c6',
          fontWeight: 'bold',
        },
        { tag: t.emphasis, fontStyle: 'italic', color: '#f8f8f2' },
        { tag: t.strong, fontWeight: 'bold', color: '#f8f8f2' },
        { tag: t.link, color: '#8be9fd', textDecoration: 'underline' },
        { tag: t.url, color: '#8be9fd' },
        { tag: t.monospace, color: '#f1fa8c' },
        { tag: t.strikethrough, textDecoration: 'line-through' },
        { tag: t.quote, fontStyle: 'italic', color: '#6272a4' },
        { tag: t.list, color: '#50fa7b' },
      ],
    });

    const customLineNumberTheme = EditorView.theme({
      '.cm-editor': {
        colorScheme: 'dark',
        backgroundColor: 'transparent',
      },
      '.cm-lineNumbers .cm-gutterElement': {
        color: '#939393',
      },
    });

    return [baseTheme, customLineNumberTheme];
  }, []);
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
  /** Enable word wrapping instead of horizontal scrolling */
  wordWrap?: boolean;
  /** JSON Schema to enable variable autocomplete for {{variable}} placeholders (markdown only) */
  schema?: JsonSchema;
} & Omit<HTMLAttributes<HTMLDivElement>, 'onChange'>;

export const CodeEditor = ({
  data,
  value,
  onChange,
  showCopyButton = true,
  className,
  language = 'json',
  highlightVariables = false,
  placeholder,
  wordWrap = false,
  schema,
  ...props
}: CodeEditorProps) => {
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

    return exts;
  }, [language, highlightVariables, schema]);

  return (
    <div
      className={cn('rounded-md bg-surface3 p-1 font-mono relative border border-border1 overflow-hidden', className)}
      {...props}
    >
      {showCopyButton && <CopyButton content={formattedCode} className="absolute top-2 right-2 z-20" />}
      <CodeMirror
        value={formattedCode}
        theme={theme}
        extensions={extensions}
        onChange={onChange}
        aria-label="Code editor"
        placeholder={placeholder}
        height="100%"
        style={{ height: '100%' }}
      />
    </div>
  );
};

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
