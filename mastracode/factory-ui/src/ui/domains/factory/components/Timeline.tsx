import type { BadgeVariant } from '@mastra/playground-ui/components/Badge';
import { Txt } from '@mastra/playground-ui/components/Txt';
import type { ReactNode } from 'react';

/** A connector is drawn down to the next row, so this gap and `RAIL_LINE`'s inset must agree. */
export const RAIL_LIST = 'm-0 flex list-none flex-col gap-6 p-0';

/** Fixed-length fade ramps capped at a third of the segment: a proportional fade leaves a short row with no line at all. */
const RAIL_LINE =
  'bg-border2 absolute top-7 -bottom-6 left-[0.875rem] w-px -translate-x-1/2 [mask-image:linear-gradient(to_bottom,transparent,#000_min(30%,1rem),#000_calc(100%-min(30%,1rem)),transparent)]';

/** `-fg` is the on-surface tone: it flips light on dark, which a bare glyph needs and the badge fills do not. */
export const RAIL_MARK_TONE: Record<BadgeVariant, string> = {
  neutral: 'text-icon3',
  green: 'text-badge-green-fg',
  red: 'text-badge-red-fg',
  blue: 'text-badge-blue-fg',
  yellow: 'text-badge-yellow-fg',
  purple: 'text-badge-purple-fg',
  orange: 'text-badge-orange-fg',
  cyan: 'text-badge-cyan-fg',
  pink: 'text-badge-pink-fg',
};

export function DayHeading({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span aria-hidden className="bg-border1 h-px flex-1" />
      <Txt as="h3" variant="ui-xs" className="text-icon3 m-0 font-medium tracking-wider uppercase">
        {children}
      </Txt>
      <span aria-hidden className="bg-border1 h-px flex-1" />
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
export const RAIL_ROW_BODY = 'hover:bg-surface4 -mx-2 rounded-lg px-2 transition-colors';
