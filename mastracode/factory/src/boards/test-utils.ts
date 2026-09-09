import type { FactoryRuleHandler, FactoryStageRuleContext } from '../rules/types.js';
import { defineBoard } from './define-board.js';
import type { BoardDefinition } from './define-board.js';
import type { BoardRegistry } from './registry.js';
import { reviewBoard } from './review.js';
import { workBoard } from './work.js';

// Unit tests inject a registry directly to exercise Work-specific runtime policies.
// Production installation still reserves built-in IDs and has no override API.
export function createLifecycleTestRegistry(handlers: BoardDefinition<string, string>['rules']): BoardRegistry {
  const board = defineBoard({
    id: 'work',
    title: 'Work lifecycle fixture',
    initialPhase: 'intake',
    phases: Object.fromEntries(
      Object.entries(workBoard.phases).map(([stage, phase]) => {
        const leaves = Object.entries(handlers[stage] ?? {});
        return [
          stage,
          {
            ...phase,
            onEnter: {
              ...phase.onEnter,
              ...Object.fromEntries(
                leaves.filter(([, leaf]) => leaf && 'onEnter' in leaf).map(([source, leaf]) => [source, leaf?.onEnter]),
              ),
            },
            onExit: {
              ...phase.onExit,
              ...Object.fromEntries(
                leaves.filter(([, leaf]) => leaf && 'onExit' in leaf).map(([source, leaf]) => [source, leaf?.onExit]),
              ),
            },
          },
        ];
      }),
    ),
  });
  return new Map<string, BoardDefinition<string, string>>([
    [board.id, board],
    [reviewBoard.id, reviewBoard],
  ]);
}

/** Work board with its tool-result rules replaced, for exercising the processor's tool ingress. */
export function createToolRuleTestRegistry(tools: BoardDefinition<string, string>['tools']): BoardRegistry {
  const board = defineBoard({
    id: 'work',
    title: 'Work tool-rule fixture',
    initialPhase: 'intake',
    phases: workBoard.phases,
    transitionPolicy: workBoard.transitionPolicy,
    tools: { ...tools },
  });
  return new Map<string, BoardDefinition<string, string>>([
    [board.id, board],
    [reviewBoard.id, reviewBoard],
  ]);
}

export function createTestBoard(
  options: { id?: string; onShipped?: FactoryRuleHandler<FactoryStageRuleContext> } = {},
) {
  return defineBoard({
    id: options.id ?? 'release',
    title: 'Release',
    initialPhase: 'queued',
    phases: {
      queued: { title: 'Queued', kind: 'resting', outcomes: { ship: 'shipping', skip: 'shipped' } },
      shipping: { title: 'Shipping', kind: 'working', role: 'release', next: 'shipped' },
      shipped: {
        title: 'Shipped',
        kind: 'terminal',
        onEnter: options.onShipped ? { issue: options.onShipped } : undefined,
      },
    },
  });
}
