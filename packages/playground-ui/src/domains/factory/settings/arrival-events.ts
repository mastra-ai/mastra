import { isOpenedLane, LANE_EVENTS } from '..';
import type { RuleEvent } from '..';

/** The triggers new issues and pull requests arrive on, the only ones the intake order asks boards about. */
export const ARRIVAL_EVENTS: readonly RuleEvent[] = LANE_EVENTS.filter(isOpenedLane);
