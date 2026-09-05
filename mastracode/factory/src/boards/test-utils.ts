import type { FactoryRuleHandler, FactoryStageRuleContext } from '../rules/types.js';
import { defineBoard } from './define-board.js';

export function createTestBoard(
  options: { id?: string; onShipped?: FactoryRuleHandler<FactoryStageRuleContext> } = {},
) {
  return defineBoard({
    id: options.id ?? 'release',
    title: 'Release',
    initialPhase: 'queued',
    phases: {
      queued: { title: 'Queued', next: 'shipped' },
      shipped: {
        title: 'Shipped',
        onEnter: options.onShipped ? { issue: options.onShipped } : undefined,
      },
    },
  });
}
