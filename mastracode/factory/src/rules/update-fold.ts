import { combineUpdates } from '../boards/board-events.js';
import type { BoardEventFacts } from '../boards/board-events.js';
import type { FactoryDeferredDecisionRecord } from '../storage/domains/work-items/base.js';

/** Statuses of an update still waiting to act, or given way to a newer one: their changes carry forward. */
export const FOLDABLE_UPDATE_STATUSES: ReadonlySet<string> = new Set(['pending', 'retry', 'leased', 'superseded']);

type UpdateRecord = Pick<FactoryDeferredDecisionRecord, 'id' | 'status' | 'createdAt' | 'decision' | 'idempotencyKey'>;
type UpdateDecision = { event: BoardEventFacts; fromCardSession?: true };

/** The transition ingress a card-move decision commits its move under. */
export function eventRouteIngress(idempotencyKey: string): string {
  return `event-route:${idempotencyKey}`;
}

/** A card's update decisions that fold together with `decision`: same event, same pull request, same session origin, oldest first. */
export function updateGroup<T extends UpdateRecord>(records: readonly T[], decision: UpdateDecision): T[] {
  return records
    .filter(other => {
      const candidate = other.decision as { type?: unknown; event?: BoardEventFacts; fromCardSession?: unknown };
      return (
        candidate.type === 'routeEvent' &&
        candidate.event?.type === decision.event.type &&
        candidate.event.pullRequest === decision.event.pullRequest &&
        (candidate.fromCardSession === true) === (decision.fromCardSession === true)
      );
    })
    .toSorted((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id));
}

/** Whether a newer update of the group, not given up on, carries update `id`'s change. Reads no storage. */
export function updateSuperseded(group: readonly Pick<UpdateRecord, 'id' | 'status'>[], id: string): boolean {
  const index = group.findIndex(other => other.id === id);
  return group.slice(index + 1).some(other => other.status !== 'failed' && other.status !== 'dismissed');
}

/**
 * How the dispatcher folds update `id` of its group: `superseded` when a newer update not given up
 * on carries this one's change (it folded it, or will), and then nothing else is read; `since` the earlier updates after the last
 * one that moved the card; `event` the net change of the foldable ones and this one, undefined when
 * it nets out to nothing. The group last moved the card at the newest update that succeeded, or
 * whose move committed (`moveCommitted`) even though its decision never finished: its change is
 * already applied.
 */
export async function foldUpdate<T extends UpdateRecord>(
  group: readonly T[],
  id: string,
  moveCommitted: (record: T) => Promise<boolean>,
): Promise<{ superseded: boolean; since: T[]; event: BoardEventFacts | undefined }> {
  const index = group.findIndex(other => other.id === id);
  const own = group[index];
  if (!own) throw new Error(`Update ${id} is not in its group.`);
  // A newer update carries this one's change, so nothing here acts: skip the reads below.
  if (updateSuperseded(group, id)) return { superseded: true, since: [], event: undefined };
  const earlier = group.slice(0, index);
  let last = earlier.findLastIndex(other => other.status === 'succeeded');
  for (let at = earlier.length - 1; at > last; at--) {
    if (await moveCommitted(earlier[at]!)) {
      last = at;
      break;
    }
  }
  const since = earlier.slice(last + 1);
  const event = combineUpdates([
    ...since
      .filter(other => FOLDABLE_UPDATE_STATUSES.has(other.status))
      .map(other => (other.decision as unknown as UpdateDecision).event),
    (own.decision as unknown as UpdateDecision).event,
  ]);
  return { superseded: false, since, event };
}
