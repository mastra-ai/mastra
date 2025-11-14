import { jsonLanguage } from '@codemirror/lang-json';
import { tags as t } from '@lezer/highlight';
import { draculaInit } from '@uiw/codemirror-theme-dracula';
import CodeMirror from '@uiw/react-codemirror';
import { useMemo } from 'react';
import { EditorView } from '@codemirror/view';
import type { Extension } from '@codemirror/state';

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
        colorScheme: 'dark', // ensures color scheme
        backgroundColor: 'transparent',
      },
      '.cm-lineNumbers .cm-gutterElement': {
        color: '#939393', // ← custom line number color
      },
    });

    // Compose both extensions into a single Extension
    return [baseTheme, customLineNumberTheme];
  }, []);
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
