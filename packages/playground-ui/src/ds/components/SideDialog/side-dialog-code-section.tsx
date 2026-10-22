import { json } from '@codemirror/lang-json';
import { EditorView } from '@codemirror/view';
import ReactCodeMirror from '@uiw/react-codemirror';
import { AlignJustifyIcon, AlignLeftIcon } from 'lucide-react';
import React, { useState, useMemo } from 'react';
import { Button } from '@/ds/components/Button';
import { ButtonsGroup } from '@/ds/components/ButtonsGroup';
import { codeFoldGutter, useCodemirrorTheme } from '@/ds/components/CodeEditor';
import { CopyButton } from '@/ds/components/CopyButton';
import { Section } from '@/ds/components/Section';
import { raisedSurfaceStyle } from '@/ds/primitives/raised-surface';

export type SideDialogCodeSectionProps = {
  title: React.ReactNode;
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
        <ButtonsGroup size="sm">
          <CopyButton content={codeStr || 'No content'} />
          {hasMultilineText && (
            <Button
              size="icon-md"
              aria-label={showAsMultilineText ? 'Show escaped newlines' : 'Show multiline text'}
              onClick={() => setShowAsMultilineText(!showAsMultilineText)}
            >
              {showAsMultilineText ? <AlignLeftIcon /> : <AlignJustifyIcon />}
            </Button>
          )}
        </ButtonsGroup>
      </Section.Header>
      {codeStr && (
        <div
          className={`${raisedSurfaceStyle} max-h-[30vh] overflow-hidden overflow-y-auto rounded-xl p-3 text-body break-all text-muted-foreground`}
        >
          {simplified ? (
            <div className="px-2 font-mono break-all text-muted-foreground">
              <pre className="text-wrap">{codeStr}</pre>
            </div>
          ) : (
            <ReactCodeMirror
              extensions={[json(), EditorView.lineWrapping, codeFoldGutter]}
              basicSetup={{ foldGutter: false }}
              theme={theme}
              value={finalCodeStr}
            />
          )}
        </div>
      )}
    </Section>
  );
}

function containsInnerNewline(obj: unknown): boolean {
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
