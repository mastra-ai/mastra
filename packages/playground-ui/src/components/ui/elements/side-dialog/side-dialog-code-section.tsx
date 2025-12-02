import ReactCodeMirror, { EditorView } from '@uiw/react-codemirror';
import { json } from '@codemirror/lang-json';
import { CopyButton } from '../../copy-button';
import { useMemo, useState } from 'react';
import { draculaInit } from '@uiw/codemirror-theme-dracula';
import { tags as t } from '@lezer/highlight';
import { Button } from '@/components/ui/elements/buttons';
import { AlignJustifyIcon, AlignLeftIcon } from 'lucide-react';
import { ButtonsGroup } from '@/components/ui/containers';
import { Section } from '@/components/ui/elements/section';

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
  icon?: React.ReactNode;
  codeStr?: string;
  simplified?: boolean;
};

export function SideDialogCodeSection({ codeStr = '', title, icon, simplified = false }: SideDialogCodeSectionProps) {
  const theme = useCodemirrorTheme();
  const [showAsMultilineText, setShowAsMultilineText] = useState(false);
  const hasMultilineText = useMemo(() => {
    try {
      const parsed = JSON.parse(codeStr);
      return containsInnerNewline(parsed || '');
    } catch {
      return false;
    }
  }, [codeStr]);

  const finalCodeStr = showAsMultilineText ? codeStr?.replace(/\\n/g, '\n') : codeStr;

  return (
    <Section>
      <Section.Header>
        <Section.Heading>
          {icon}
          {title}
        </Section.Heading>
        <ButtonsGroup>
          <CopyButton content={codeStr || 'No content'} />
          {hasMultilineText && (
            <Button variant="ghost" onClick={() => setShowAsMultilineText(!showAsMultilineText)}>
              {showAsMultilineText ? <AlignLeftIcon /> : <AlignJustifyIcon />}
            </Button>
          )}
        </ButtonsGroup>
      </Section.Header>
      {codeStr && (
        <div className="bg-black/20 p-[1rem] overflow-hidden rounded-xl border border-white/10 text-icon4 text-[0.875rem] break-all">
          {simplified ? (
            <div className="text-icon4 font-mono break-all px-[0.5rem]">
              <pre className="text-wrap">{codeStr}</pre>
            </div>
          ) : (
            <ReactCodeMirror extensions={[json(), EditorView.lineWrapping]} theme={theme} value={finalCodeStr} />
          )}
        </div>
      )}
    </Section>
  );
}

export function containsInnerNewline(obj: unknown): boolean {
  if (typeof obj === 'string') {
    const idx = obj.indexOf('\n');
    return idx !== -1 && idx !== obj.length - 1;
  } else if (Array.isArray(obj)) {
    return obj.some(item => containsInnerNewline(item));
  } else if (obj && typeof obj === 'object') {
    return Object.values(obj).some(value => containsInnerNewline(value));
  }
  return false;
}
