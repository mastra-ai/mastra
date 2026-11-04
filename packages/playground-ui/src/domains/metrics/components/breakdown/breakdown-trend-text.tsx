import type { ReactNode } from 'react';
import { DASH } from '../../lib/breakdown-table';

const TREND_CLASS = { good: 'text-badge-green-foreground', bad: 'text-badge-red-foreground' } as const;

/**
 * A change, green when it's good news and red when it's bad; without one, a muted dash. The cell sits
 * in the list's main column, so a flat change is muted too.
 */
export function BreakdownTrendText({ trend, children }: { trend: 'good' | 'bad' | undefined; children?: ReactNode }) {
  if (children === undefined) return <span className="text-muted-foreground">{DASH}</span>;
  return <span className={trend ? TREND_CLASS[trend] : 'text-muted-foreground'}>{children}</span>;
}
