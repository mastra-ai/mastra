import type { ReactNode } from 'react';
import { Txt } from '@/ds/components/Txt';

export interface TranscriptDividerProps {
  label: string;
  title?: string;
  children?: ReactNode;
  hideLabel?: boolean;
}

export function TranscriptDivider({ label, title, children, hideLabel = false }: TranscriptDividerProps) {
  if (!label) return null;

  return (
    <div
      className="flex items-center gap-3 py-3"
      role={children != null ? 'group' : 'separator'}
      aria-label={title ? `${label}: ${title}` : label}
    >
      <span aria-hidden className="h-px flex-1 bg-border" />
      <div className="flex shrink-0 items-center gap-2 whitespace-nowrap">
        {!hideLabel && (
          <Txt as="span" variant="meta" tone="muted" title={title} className="shrink-0">
            {label}
          </Txt>
        )}
        {children}
      </div>
      <span aria-hidden className="h-px flex-1 bg-border" />
    </div>
  );
}
