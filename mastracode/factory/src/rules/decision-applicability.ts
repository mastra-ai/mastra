import { boardForWorkItem, resolvePhaseSemantics } from '../boards/index.js';
import type { BoardRegistry } from '../boards/index.js';
import type {
  FactoryDeferredDecisionRecord,
  WorkItemRow,
  WorkItemsStorage,
} from '../storage/domains/work-items/base.js';

type ApplicabilityRecord = Pick<FactoryDeferredDecisionRecord, 'id' | 'evaluationId' | 'createdAt' | 'decision'>;

/** The seat a skill run needs; other decision types are not tied to one phase. */
export function skillDecisionRole(record: Pick<FactoryDeferredDecisionRecord, 'decision'>): string | undefined {
  const { type, role } = record.decision;
  return type === 'invokeSkill' && typeof role === 'string' ? role : undefined;
}

/**
 * Whether the card has moved on from the phase a run was decided for: any stage it
 * now sits in was entered after the decision. Anchored on the decision rather than
 * an attempt, so a retry after the move is still recognised as stale, and a card
 * that left and came back to the same role is a new phase entry.
 */
export function decisionOvertaken(input: {
  boards: BoardRegistry;
  item: WorkItemRow | null;
  record: ApplicabilityRecord;
  role: string;
  /** Decisions from the same rule evaluation as `record`. */
  siblings: ApplicabilityRecord[];
}): boolean {
  const { boards, item, record, role } = input;
  if (item === null) return true;
  const decidedAt = record.createdAt.getTime();
  const enteredSince = item.stageHistory.filter(
    entry => entry.exitedAt === undefined && new Date(entry.enteredAt).getTime() > decidedAt,
  );
  // A run decided while the card sat outside its seat's stages (a held
  // triage in Intake) is fulfilled, not overtaken, when the card first
  // enters a stage that seat carries — e.g. the Investigate click.
  const board = boardForWorkItem(item);
  const carriesRole = (stage: string) => resolvePhaseSemantics(boards, board, stage)?.role === role;
  const decidedOutsideRole = !item.stageHistory.some(
    entry =>
      new Date(entry.enteredAt).getTime() <= decidedAt &&
      (entry.exitedAt === undefined || new Date(entry.exitedAt).getTime() > decidedAt) &&
      carriesRole(entry.stage),
  );
  const movedOn = decidedOutsideRole ? enteredSince.filter(entry => !carriesRole(entry.stage)) : enteredSince;
  if (movedOn.length === 0) return false;
  // A transition from the same rule evaluation lands after this decision
  // was created; entering that stage is part of this run's intent.
  const siblingStages = new Set(
    input.siblings
      .filter(sibling => sibling.evaluationId === record.evaluationId && sibling.decision.type === 'transition')
      .map(sibling => sibling.decision.stage),
  );
  return movedOn.some(entry => !siblingStages.has(entry.stage));
}

/** Ids of the given skill-run decisions whose card has moved on from their phase. */
export async function overtakenDecisionIds(
  workItems: Pick<WorkItemsStorage, 'listByIds' | 'listDecisionsForEvaluations'>,
  boards: BoardRegistry,
  scope: { orgId: string; factoryProjectId: string },
  records: FactoryDeferredDecisionRecord[],
): Promise<Set<string>> {
  const candidates = records.filter(record => record.workItemId !== null && skillDecisionRole(record) !== undefined);
  if (candidates.length === 0) return new Set();
  const [items, siblings] = await Promise.all([
    workItems.listByIds({ ...scope, ids: [...new Set(candidates.map(record => record.workItemId!))] }),
    workItems.listDecisionsForEvaluations(
      scope.orgId,
      scope.factoryProjectId,
      candidates.map(record => record.evaluationId),
    ),
  ]);
  const itemsById = new Map(items.map(item => [item.id, item]));
  return new Set(
    candidates
      .filter(record =>
        decisionOvertaken({
          boards,
          item: itemsById.get(record.workItemId!) ?? null,
          record,
          role: skillDecisionRole(record)!,
          siblings,
        }),
      )
      .map(record => record.id),
  );
}
