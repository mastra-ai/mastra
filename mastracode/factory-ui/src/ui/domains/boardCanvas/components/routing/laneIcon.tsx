import { cn } from '@mastra/playground-ui/utils/cn';

import { isOpenedLane, LANE_EVENTS, laneText } from '../../../boardRules/ruleLanes';
import type { RuleEvent } from '../../../boardRules/ruleLanes';

/** The triggers new issues and pull requests arrive on, the only ones the intake order asks boards about. */
export const ARRIVAL_EVENTS: readonly RuleEvent[] = LANE_EVENTS.filter(isOpenedLane);

/** A trigger's icon, the same one its label on the board canvas wears. */
export function LaneIcon({ event, className }: { event: RuleEvent; className?: string }) {
  const { icon: Icon } = laneText(event);
  return <Icon className={cn('text-muted-foreground size-icon-xs shrink-0', className)} aria-hidden />;
}
