import { cn } from '@/lib/utils';
import ReactCodeMirror, { EditorView } from '@uiw/react-codemirror';
import { json } from '@codemirror/lang-json';
import { CopyButton } from '../../copy-button';
import { useMemo, useState } from 'react';
import { draculaInit } from '@uiw/codemirror-theme-dracula';
import { Colors } from '@/ds/tokens';
import { tags as t } from '@lezer/highlight';
import { Button } from '../buttons';
import { AlignJustifyIcon, AlignLeftIcon, ListOrderedIcon, WrapTextIcon } from 'lucide-react';

const useCodemirrorTheme = () => {
  return useMemo(
    () =>
      draculaInit({
        settings: {
          fontFamily: 'var(--geist-mono)',
          fontSize: '0.8125rem',
          lineHighlight: 'transparent',
          gutterBackground: 'transparent',
          gutterForeground: '#939393',
          background: 'transparent',
        },
        styles: [{ tag: [t.className, t.propertyName] }],
      }),
    [],
  );
};

export type SideDialogCodeSectionProps = {
  title: string;
  codeStr?: string;
};

export function SideDialogCodeSection({ codeStr = '', title }: SideDialogCodeSectionProps) {
  const theme = useCodemirrorTheme();
  const [isWrapped, setIsWrapped] = useState(false);
  const [isMultilineText, setIsMultilineText] = useState(false);
  const finalCodeStr = isMultilineText ? codeStr?.replace(/\\n/g, '\n') : codeStr;

  return (
    <section className="border border-border1 rounded-lg">
      <div className="border-b border-border1 last:border-b-0 grid">
        <div className="p-[1rem] px-[1.5rem] border-b border-border1 grid grid-cols-[1fr_auto]">
          <h3>{title}</h3>
          <div className="flex gap-2 items-center justify-end">
            <CopyButton content={codeStr || 'No content'} />
            <Button variant="ghost" onClick={() => setIsWrapped(!isWrapped)}>
              {isWrapped ? <ListOrderedIcon /> : <WrapTextIcon />}
            </Button>
            <Button variant="ghost" onClick={() => setIsMultilineText(!isMultilineText)}>
              {isMultilineText ? <AlignLeftIcon /> : <AlignJustifyIcon />}
            </Button>
          </div>
        </div>
        <div
          className={cn('bg-surface3 p-[1rem] overflow-auto text-icon4 text-[0.875rem] [&>div]:border-none break-all')}
        >
          {/* <CodeMirrorBlock value={JSON.stringify(span?.output || {}, null, 2).replace(/\\n/g, '\n')} /> */}
          {codeStr && (
            <ReactCodeMirror
              extensions={[json(), isWrapped ? EditorView.lineWrapping : []]}
              theme={theme}
              value={finalCodeStr}
            />
          )}
        </div>
      </div>
    </section>
  );
}
