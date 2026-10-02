import type { BadgeVariant } from '@mastra/playground-ui/components/Badge';
import { Txt } from '@mastra/playground-ui/components/Txt';
import type { ReactNode } from 'react';

/** A connector is drawn down to the next row, so this gap and `RAIL_LINE`'s inset must agree. */
export const RAIL_LIST = 'm-0 flex list-none flex-col gap-6 p-0';

/** Fixed-length fade ramps capped at a third of the segment: a proportional fade leaves a short row with no line at all. */
const RAIL_LINE =
  'bg-border-strong absolute top-7 -bottom-6 left-[0.875rem] w-px -translate-x-1/2 [mask-image:linear-gradient(to_bottom,transparent,#000_min(30%,1rem),#000_calc(100%-min(30%,1rem)),transparent)]';

export const RAIL_MARK_TONE: Record<BadgeVariant, string> = {
  studio: 'text-product-studio-foreground',
  server: 'text-product-server-foreground',
  observability: 'text-product-observability-foreground',
  factory: 'text-product-factory-foreground',
  workers: 'text-product-workers-foreground',
  'persistent-server': 'text-product-persistent-server-foreground',
  neutral: 'text-muted-foreground',
  green: 'text-badge-green-indicator',
  red: 'text-badge-red-indicator',
  amber: 'text-badge-amber-indicator',
  blue: 'text-badge-blue-indicator',
  success: 'text-success-indicator',
  destructive: 'text-destructive-foreground',
  info: 'text-info-indicator',
  warning: 'text-warning-foreground',
  purple: 'text-badge-purple-indicator',
  orange: 'text-badge-orange-indicator',
  cyan: 'text-badge-cyan-indicator',
  pink: 'text-badge-pink-indicator',
};

export function DayHeading({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span aria-hidden className="bg-border h-px flex-1" />
      <Txt as="h3" variant="meta" className="text-muted-foreground m-0 tracking-wider uppercase">
        {children}
      </Txt>
      <span aria-hidden className="bg-border h-px flex-1" />
    </div>
  );
}

export function RailRow({ mark, connected, children }: { mark: ReactNode; connected: boolean; children: ReactNode }) {
  return (
    <li className="relative grid grid-cols-[1.75rem_minmax(0,1fr)] gap-x-3">
      {connected ? <span aria-hidden className={RAIL_LINE} /> : null}
      <span className="grid size-7 place-items-center">{mark}</span>
      <div className="min-w-0">{children}</div>
    </li>
  );
}

/** A row that owns its hover pill, sat directly on the page rather than in a panel. */
export const RAIL_ROW_BODY = 'hover:bg-fill -mx-2 rounded-lg px-2 transition-colors';
