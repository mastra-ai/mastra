import { isOpenedLane, LANE_EVENTS, laneText } from '..';

import type { RuleEvent } from '..';
import { cn } from '@/lib/utils';

/** A trigger's icon, the same one its label on the board canvas wears. */
export function LaneIcon({ event, className }: { event: RuleEvent; className?: string }) {
  const { icon: Icon } = laneText(event);
  return <Icon className={cn('size-icon-xs shrink-0 text-muted-foreground', className)} aria-hidden />;
}
