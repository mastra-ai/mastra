import { jsonLanguage } from '@codemirror/lang-json';
import { tags as t } from '@lezer/highlight';
import { draculaInit } from '@uiw/codemirror-theme-dracula';
import CodeMirror from '@uiw/react-codemirror';
import clsx from 'clsx';
import { useMemo } from 'react';
import { CopyButton } from './copy-button';

export const useCodemirrorTheme = () => {
  return useMemo(
    () =>
      draculaInit({
        settings: {
          fontFamily: 'var(--geist-mono)',
          fontSize: '0.8rem',
          lineHighlight: 'transparent',
          gutterBackground: 'transparent',
          background: 'transparent',
          gutterForeground: '#939393',
        },
        styles: [{ tag: [t.className, t.propertyName] }],
      }),
    [],
  );
};

export const SyntaxHighlighter = ({ data, className }: { data: Record<string, unknown>; className?: string }) => {
  const formattedCode = JSON.stringify(data, null, 2);
  const theme = useCodemirrorTheme();

  return (
    <div className={clsx('rounded-md bg-surface4 p-1 font-mono relative', className)}>
      <CopyButton content={formattedCode} className="absolute top-2 right-2" />
      <CodeMirror value={formattedCode} theme={theme} extensions={[jsonLanguage]} />
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
