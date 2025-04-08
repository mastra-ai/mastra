import { jsonLanguage } from '@codemirror/lang-json';
import { tags as t } from '@lezer/highlight';
import { githubDarkInit } from '@uiw/codemirror-theme-github';
import CodeMirror from '@uiw/react-codemirror';
import { useMemo } from 'react';

export const useCodemirrorTheme = () => {
  return useMemo(
    () =>
      githubDarkInit({
        settings: {
          fontFamily: 'var(--geist-mono)',
          fontSize: '0.8rem',
          foreground: '#030712',
          background: '#1a1a1a',
          gutterBackground: '#1a1a1a',
          gutterForeground: '#94A3B8',
          gutterBorder: '#1a1a1a',
          lineHighlight: 'transparent',
        },
        styles: [{ tag: [t.className, t.propertyName], color: '#22c5ee' }],
      }),
    [],
  );
};

export const SyntaxHighlighter = ({ data }: { data: Record<string, unknown> }) => {
  const formattedCode = JSON.stringify(data, null, 2);
  const theme = useCodemirrorTheme();

  return (
    <div className="rounded-md bg-[#1a1a1a] p-1 font-mono">
      <CodeMirror value={formattedCode} theme={theme} extensions={[jsonLanguage]} />
    </div>
  );
};
