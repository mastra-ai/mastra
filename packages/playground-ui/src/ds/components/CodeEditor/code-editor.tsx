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

import { CopyButton } from '@/ds/components/CopyButton';
import { variableHighlight } from './variable-highlight-extension';

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
        // JSON styles
        { tag: [t.className, t.propertyName] },
        // Markdown styles
        {
          tag: [t.heading1, t.heading2, t.heading3, t.heading4, t.heading5, t.heading6],
          color: '#BD93F9',
          fontWeight: 'bold',
        },
        { tag: t.emphasis, fontStyle: 'italic', color: '#F1FA8C' },
        { tag: t.strong, fontWeight: 'bold', color: '#FFB86C' },
        { tag: t.link, color: '#8BE9FD', textDecoration: 'underline' },
        { tag: t.url, color: '#8BE9FD' },
        { tag: t.strikethrough, textDecoration: 'line-through' },
        { tag: t.quote, color: '#6272A4', fontStyle: 'italic' },
        { tag: t.monospace, color: '#50FA7B' },
        { tag: [t.processingInstruction, t.inserted], color: '#50FA7B' },
        { tag: t.contentSeparator, color: '#6272A4' },
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

const getLanguageExtension = (language: CodeEditorLanguage): Extension => {
  switch (language) {
    case 'markdown':
      return markdown({ base: markdownLanguage });
    case 'json':
    default:
      return jsonLanguage;
  }
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

    return exts;
  }, [language, highlightVariables]);

  return (
    <div className={cn('rounded-md bg-surface4 p-1 font-mono relative', className)} {...props}>
      {showCopyButton && <CopyButton content={formattedCode} className="absolute top-2 right-2 z-20" />}
      <CodeMirror
        value={formattedCode}
        theme={theme}
        extensions={extensions}
        onChange={onChange}
        aria-label="Code editor"
        placeholder={placeholder}
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
