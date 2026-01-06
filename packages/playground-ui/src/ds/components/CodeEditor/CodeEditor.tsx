import { jsonLanguage } from '@codemirror/lang-json';
import { EditorView } from '@codemirror/view';
import { tags as t } from '@lezer/highlight';
import { draculaInit } from '@uiw/codemirror-theme-dracula';
import CodeMirror from '@uiw/react-codemirror';
import clsx from 'clsx';
import { HTMLAttributes, useMemo } from 'react';

import type { Extension } from '@codemirror/state';

import { CopyButton } from '@/components/ui/copy-button';

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
      styles: [{ tag: [t.className, t.propertyName] }],
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
} & Omit<HTMLAttributes<HTMLDivElement>, 'onChange'>;

export const CodeEditor = ({
  data,
  value,
  onChange,
  showCopyButton = true,
  className,
  ...props
}: CodeEditorProps) => {
  const theme = useCodemirrorTheme();
  const formattedCode = data ? JSON.stringify(data, null, 2) : value ?? '';

  return (
    <div className={clsx('rounded-md bg-surface4 p-1 font-mono relative', className)} {...props}>
      {showCopyButton && <CopyButton content={formattedCode} className="absolute top-2 right-2 z-20" />}
      <CodeMirror value={formattedCode} theme={theme} extensions={[jsonLanguage]} onChange={onChange} />
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
