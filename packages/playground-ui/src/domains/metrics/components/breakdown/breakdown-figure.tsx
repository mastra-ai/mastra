import type { ReactNode } from 'react';
import { Txt } from '@/ds/components/Txt';

/** A table figure in fixed-width digits; `muted` for the figures beside the one the table ranks by. */
export function BreakdownFigure({ muted = false, children }: { muted?: boolean; children: ReactNode }) {
  return (
    <Txt as="span" variant="body-sm" tone={muted ? 'muted' : undefined} className="tabular-nums">
      {children}
    </Txt>
  );
}
