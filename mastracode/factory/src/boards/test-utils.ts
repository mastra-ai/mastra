import { randomUUID } from 'node:crypto';
import { validateFactoryRuleDecisions } from '../rules/validation.js';
import type { WorkItemsStorage } from '../storage/domains/work-items/base.js';
import { defineBoard } from './define-board.js';
import type { BoardDefinition, BoardPhaseDefinition, BoardPhaseRunner } from './define-board.js';
import type { BoardRegistry, InstalledBoard } from './registry.js';
import { compileStoredBoard } from './stored-board.js';
import type { BoardTransitionPolicy } from './transition-policy.js';
import { workSeedWithSelfReview } from './work-migrations.js';
import { workBoard } from './work.js';

// Unit tests inject a registry directly to exercise Work-specific runtime policies.
// Production installation still reserves built-in IDs and has no override API.
/** The lifecycle registry's Work board with a board policy standing in for the rules a move is evaluated against. */
export function createPolicyTestRegistry(transitionPolicy: BoardTransitionPolicy): BoardRegistry {
  const lifecycle = createLifecycleTestRegistry().get('work')!;
  const board = defineBoard({
    id: 'work',
    name: 'Work',
    initialPhase: 'intake',
    phases: lifecycle.phases as unknown as Record<string, BoardPhaseDefinition<string>>,
    transitionPolicy,
  });
  return new Map([[board.id, board]]);
}

/**
 * Work as projects stored it while Work still had its `review` self-review phase. Work's seed
 * dropped that phase, but a project's stored row keeps it, and other boards may declare one.
 */
export const selfReviewWorkBoard: InstalledBoard = compileStoredBoard(workSeedWithSelfReview(), workBoard);

/**
 * Work (with its self-review phase, {@link selfReviewWorkBoard}) with every phase allowed to move
 * to every other, and the given phases' stored fields overridden (a runner, …). Lifecycle tests
 * jump straight to the phase they exercise; the Work board's own topology is tested against
 * workBoard itself.
 */
export function createLifecycleTestRegistry(
  overrides: Partial<Record<string, { runner?: BoardPhaseRunner }>> = {},
): BoardRegistry {
  const board = defineBoard({
    id: 'work',
    title: 'Work lifecycle fixture',
    initialPhase: 'intake',
    sourceClosed: workBoard.sourceClosed,
    phases: Object.fromEntries(
      Object.entries(selfReviewWorkBoard.phases).map(([stage, phase]) => {
        return [
          stage,
          {
            ...phase,
            nextPhases: Object.keys(selfReviewWorkBoard.phases).filter(other => other !== stage),
            ...overrides[stage],
          } as BoardPhaseDefinition<string>,
        ];
      }),
    ),
  });
  return new Map<string, BoardDefinition<string, string>>([[board.id, board]]);
}

/** Work board with the given tool-result rules, for exercising the processor's tool ingress. */
export function createToolRuleTestRegistry(tools: BoardDefinition<string, string>['tools']): BoardRegistry {
  const board = defineBoard({
    id: 'work',
    title: 'Work tool-rule fixture',
    initialPhase: 'intake',
    phases: workBoard.phases,
    transitionPolicy: workBoard.transitionPolicy,
    sourceClosed: workBoard.sourceClosed,
    tools: { ...tools },
  });
  return new Map<string, BoardDefinition<string, string>>([[board.id, board]]);
}

/**
 * Commits a move of the card into `stage` whose evaluation queued `decisions`, the way an accepted
 * transition persists the decisions its rules returned. Tests that exercise how the dispatcher
 * executes a decision queue it this way; phases themselves only ever start their runner.
 */
export async function commitDecisions(
  storage: WorkItemsStorage,
  input: {
    orgId?: string;
    factoryProjectId: string;
    workItemId: string;
    stage: string;
    decisions: readonly unknown[];
    ingress?: string;
    actorId?: string;
    configVersion?: string;
    causalChain?: Array<{ ingressId: string; decisionType: string }>;
  },
) {
  const orgId = input.orgId ?? 'org-1';
  const item = await storage.get({ orgId, id: input.workItemId });
  if (!item) throw new Error(`Expected work item ${input.workItemId}.`);
  const decisions = validateFactoryRuleDecisions(input.decisions, input.causalChain?.length ?? 0);
  const ingress = input.ingress ?? `commit-${randomUUID()}`;
  const committed = await storage.commitTransition({
    orgId,
    factoryProjectId: input.factoryProjectId,
    workItemId: input.workItemId,
    expectedRevision: item.revision,
    destinationStage: input.stage,
    actorId: input.actorId ?? 'factory-rule-dispatcher',
    ingress: { identity: ingress, triggerType: 'rule', transitionId: randomUUID() },
    configVersion: input.configVersion ?? 'rules-v1',
    causalChain: input.causalChain ?? [],
    evaluation: { outcome: 'accepted', decisions: decisions as unknown as Record<string, unknown>[] },
  });
  if (committed.status === 'missing') throw new Error(`Expected work item ${input.workItemId}.`);
  return committed;
}

export function createTestBoard(options: { id?: string; shippingRunner?: Omit<BoardPhaseRunner, 'context'> } = {}) {
  return defineBoard({
    id: options.id ?? 'release',
    title: 'Release',
    initialPhase: 'queued',
    phases: {
      queued: { title: 'Queued', kind: 'resting', nextPhases: ['shipping', 'shipped'] },
      shipping: {
        title: 'Shipping',
        kind: 'working',
        runner: { ...options.shippingRunner, context: 'release' },
        next: 'shipped',
      },
      shipped: { title: 'Shipped', kind: 'terminal' },
    },
  });
}
