import { Colors } from '@/ds/tokens';
import { stringify } from 'superjson';
import { jsonLanguage } from '@codemirror/lang-json';
import { tags as t } from '@lezer/highlight';
import { draculaInit } from '@uiw/codemirror-theme-dracula';
import CodeMirror from '@uiw/react-codemirror';
import { useEffect, useMemo, useState } from 'react';
import { formatJSON } from '@/lib/formatting';
import { CopyButton } from './ui/copy-button';
import clsx from 'clsx';

export const useCodemirrorTheme = () => {
  return useMemo(
    () =>
      draculaInit({
        settings: {
          fontFamily: 'var(--geist-mono)',
          fontSize: '0.8rem',
          lineHighlight: 'transparent',
          gutterBackground: 'transparent',
          gutterForeground: Colors.surface3,
          background: 'transparent',
        },
        styles: [{ tag: [t.className, t.propertyName] }],
      }),
    [],
  );
};

export const SyntaxHighlighter = ({ data, className }: { data: Record<string, unknown>; className?: string }) => {
  const [formattedCode, setFormattedCode] = useState(stringify(data));
  const stringified = stringify(data);
  const theme = useCodemirrorTheme();

  useEffect(() => {
    const run = async () => {
      const formatted = await formatJSON(stringified);
      setFormattedCode(formatted);
    };

    run();
  }, [stringified]);

  return (
    <div className={clsx('rounded-md bg-surface4 p-1 font-mono relative', className)}>
      <CopyButton content={formattedCode} className="absolute top-2 right-2" />
      <CodeMirror value={formattedCode} theme={theme} extensions={[jsonLanguage]} />
    </div>
  );
};
