import type { ReactNode } from 'react';
import { Txt } from '@/ds/components/Txt';

export interface TranscriptDividerProps {
  label: string;
  title?: string;
  /** Trailing content (e.g. tabs or actions), shown after the label behind a `·` separator. */
  children?: ReactNode;
  /** Hides the visible label (and its separator); it stays the accessible name. */
  hideLabel?: boolean;
}

export function TranscriptDivider({ label, title, children, hideLabel = false }: TranscriptDividerProps) {
  if (!label) return null;

  // A `separator`'s children are presentational, which would hide interactive children from
  // assistive tech; with children the divider is a labelled group instead.
  return (
    <div
      className="flex items-center gap-3 py-3"
      role={children != null ? 'group' : 'separator'}
      aria-label={title ? `${label} — ${title}` : label}
    >
      <span aria-hidden className="h-px flex-1 bg-border" />
      <div className="flex shrink-0 items-center gap-2">
        {!hideLabel && (
          <Txt as="span" variant="meta" tone="muted" title={title} className="shrink-0">
            {label}
          </Txt>
        )}
        {children != null && (
          <>
            {!hideLabel && (
              <Txt as="span" variant="meta" tone="muted" aria-hidden>
                ·
              </Txt>
            )}
            {children}
          </>
        )}
      </div>
      <span aria-hidden className="h-px flex-1 bg-border" />
    </div>
  );
}
