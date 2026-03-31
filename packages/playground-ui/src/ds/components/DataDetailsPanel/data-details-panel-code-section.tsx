import { json } from '@codemirror/lang-json';
import { tags as t } from '@lezer/highlight';
import { draculaInit } from '@uiw/codemirror-theme-dracula';
import ReactCodeMirror, { EditorView } from '@uiw/react-codemirror';
import { AlignJustifyIcon, AlignLeftIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/ds/components/Button';
import { ButtonsGroup } from '@/ds/components/ButtonsGroup';
import { CopyButton } from '@/ds/components/CopyButton';
import { cn } from '@/lib/utils';

const useCodemirrorTheme = () => {
  return useMemo(
    () =>
      draculaInit({
        settings: {
          fontFamily: 'var(--geist-mono)',
          fontSize: '0.75rem',
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

export interface DataDetailsPanelCodeSectionProps {
  title: React.ReactNode;
  icon?: React.ReactNode;
  codeStr?: string;
  simplified?: boolean;
  className?: string;
}

export function DataDetailsPanelCodeSection({
  codeStr = '',
  title,
  icon,
  simplified = false,
  className,
}: DataDetailsPanelCodeSectionProps) {
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

  if (!codeStr || codeStr === 'null') return null;

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex items-center justify-between">
        <div
          className={cn(
            'flex items-center gap-1.5 text-ui-xs uppercase tracking-widest text-neutral2',
            '[&>svg]:size-3.5',
          )}
        >
          {icon}
          {title}
        </div>
        <ButtonsGroup>
          <CopyButton content={codeStr || 'No content'} size="sm" />
          {hasMultilineText && (
            <Button size="sm" onClick={() => setShowAsMultilineText(!showAsMultilineText)}>
              {showAsMultilineText ? <AlignLeftIcon /> : <AlignJustifyIcon />}
            </Button>
          )}
        </ButtonsGroup>
      </div>
      <div className="bg-black/20 p-3 overflow-hidden rounded-lg border border-white/10 text-neutral4 text-ui-sm break-all max-h-[30vh] overflow-y-auto">
        {simplified ? (
          <div className="text-neutral4 font-mono break-all">
            <pre className="text-wrap">{codeStr}</pre>
          </div>
        ) : (
          <ReactCodeMirror
            extensions={[json(), EditorView.lineWrapping]}
            theme={theme}
            value={finalCodeStr}
            editable={false}
          />
        )}
      </div>
    </div>
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
