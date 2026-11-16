import { isRunBearingDecision } from '../rules/dispatcher.js';
import { currentStage } from '../rules/transition-service.js';
import type { Card, FactoryDeferredDecisionRecord, WorkItemsStorage } from '../storage/domains/work-items/base.js';
import type { RunQueueResponse } from './contracts.js';

const LISTED_WAITING_RUNS = 50;

type RunQueueEntry = RunQueueResponse['claimed'][number];

/** A lease past its expiry belongs to a server that stopped renewing it: the next claim takes it back. */
function holdsSlot(decision: FactoryDeferredDecisionRecord, now: Date): boolean {
  return decision.status === 'leased' && (decision.leaseExpiresAt?.getTime() ?? 0) > now.getTime();
}

function waitsForSlot(decision: FactoryDeferredDecisionRecord, now: Date): boolean {
  if (decision.status === 'leased') return !holdsSlot(decision, now);
  // A postponed move or a retry backing off is not waiting on a slot yet.
  return decision.availableAt.getTime() <= now.getTime();
}

function entry(
  decision: FactoryDeferredDecisionRecord,
  state: RunQueueEntry['state'],
  cards: ReadonlyMap<string, Card>,
): RunQueueEntry {
  const payload = decision.decision;
  const card = decision.workItemId ? cards.get(decision.workItemId) : undefined;
  const since =
    state === 'claimed'
      ? decision.updatedAt
      : new Date(Math.max(decision.createdAt.getTime(), decision.availableAt.getTime()));
  return {
    decisionId: decision.id,
    state,
    type: payload.type as RunQueueEntry['type'],
    role: typeof payload.role === 'string' ? payload.role : null,
    skillName: payload.type === 'invokeSkill' && typeof payload.skillName === 'string' ? payload.skillName : null,
    queuedSince: since.toISOString(),
    workItem: card
      ? {
          id: card.id,
          key: card.workItem.key,
          title: card.title,
          board: card.board,
          phase: currentStage(card.stages) ?? null,
        }
      : null,
  };
}

/**
 * The project's run-bearing decisions in the order the dispatcher claims them (oldest first),
 * split into those waiting for a slot and those a server already holds one for.
 */
export async function readRunQueue(input: {
  workItems: WorkItemsStorage;
  orgId: string;
  factoryProjectId: string;
  slots: { inUse: number; cap: number } | undefined;
  now: Date;
}): Promise<RunQueueResponse> {
  const { workItems, orgId, factoryProjectId, now } = input;
  const open = (
    await workItems.listDeferredDecisions(orgId, factoryProjectId, { statuses: ['pending', 'retry', 'leased'] })
  ).filter(decision => isRunBearingDecision(decision.decision));
  const claimed = open.filter(decision => holdsSlot(decision, now));
  const waiting = open.filter(decision => waitsForSlot(decision, now));
  const listed = waiting.slice(0, LISTED_WAITING_RUNS);
  const ids = [...claimed, ...listed].flatMap(decision => (decision.workItemId ? [decision.workItemId] : []));
  const cards = new Map((await workItems.listByIds({ orgId, factoryProjectId, ids })).map(card => [card.id, card]));
  return {
    slots: input.slots ? { scope: 'server', ...input.slots } : null,
    running: claimed.length,
    claimed: claimed.map(decision => entry(decision, 'claimed', cards)),
    queuedCount: waiting.length,
    queued: listed.map((decision, index) => ({ ...entry(decision, 'waiting', cards), position: index + 1 })),
  };
}
