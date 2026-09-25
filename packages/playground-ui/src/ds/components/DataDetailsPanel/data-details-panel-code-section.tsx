import { AlignJustifyIcon, AlignLeftIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/ds/components/Button';
import { ButtonsGroup } from '@/ds/components/ButtonsGroup';
import { Code } from '@/ds/components/Code/code';
import { CopyButton } from '@/ds/components/CopyButton';
import { raisedSurfaceStyle } from '@/ds/primitives/raised-surface';
import { cn } from '@/lib/utils';

export interface DataDetailsPanelCodeSectionProps {
  title: React.ReactNode;
  icon?: React.ReactNode;
  codeStr?: string;
  simplified?: boolean;
  className?: string;
  /** Extra controls rendered in the header, before the built-in copy button. */
  actions?: React.ReactNode;
}

export function DataDetailsPanelCodeSection({
  codeStr = '',
  title,
  icon,
  simplified = false,
  className,
  actions,
}: DataDetailsPanelCodeSectionProps) {
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
  const usePlainTextView = simplified || showAsMultilineText;

  if (!codeStr || codeStr === 'null') return null;

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex items-center justify-between">
        <div className={cn('flex items-center gap-1.5 text-column text-placeholder uppercase', '[&>svg]:size-3.5')}>
          {icon}
          {title}
        </div>
        <div className="flex items-center gap-2">
          {actions}
          <ButtonsGroup size="sm">
            <CopyButton content={codeStr || 'No content'} />
            {hasMultilineText && (
              <Button
                aria-label={showAsMultilineText ? 'Show escaped newlines' : 'Show multiline text'}
                onClick={() => setShowAsMultilineText(v => !v)}
              >
                {showAsMultilineText ? <AlignLeftIcon /> : <AlignJustifyIcon />}
              </Button>
            )}
          </ButtonsGroup>
        </div>
      </div>
      <div
        className={cn(
          raisedSurfaceStyle,
          'max-h-[30vh] overflow-hidden overflow-y-auto rounded-lg p-3 text-caption break-all text-muted-foreground',
        )}
      >
        {usePlainTextView ? (
          <div className="font-mono break-all text-muted-foreground">
            <pre className="text-wrap">{finalCodeStr}</pre>
          </div>
        ) : (
          <Code code={codeStr} lang="json" className="font-mono text-caption break-all whitespace-pre-wrap" />
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
