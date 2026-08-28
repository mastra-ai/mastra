import type { ProcessInputStepArgs, ProcessLLMRequestArgs, ProcessLLMRequestResult } from '@mastra/core/processors';

import type { RemindConversation } from './remind-request-state';
import { RemindRequestRegistry } from './remind-request-state';

const NUDGE_INTERVAL_MS = 20_000;
const MAX_LEVEL = 3;
const BUDGET_STATE_KEY = 'subconsciousRemindBudget';

type BudgetState = {
  emittedLevels: Record<string, number>;
  pendingNudge?: {
    correlationId: string;
    level: number;
    transient: true;
    contents: string;
  };
};

function nudgeText(level: number, elapsedSeconds: number): string {
  if (level === 1) {
    return `The asker has waited ${elapsedSeconds}s. Send a useful partial delta now with more_coming=true, then continue researching.`;
  }
  if (level === 2) {
    return `The asker has waited ${elapsedSeconds}s. Synthesize what you know and send another partial delta unless the final answer is immediately available.`;
  }
  return `The asker has waited ${elapsedSeconds}s. Reply this step with a final delta, or plainly report what remains blocked. Do not start another search.`;
}

function correlationIds(messages: ProcessInputStepArgs['messages']): string[] {
  const ids = new Set<string>();
  for (const message of messages as Array<{ metadata?: Record<string, unknown> }>) {
    if (message.metadata?.kind !== 'remind-ask' || typeof message.metadata.correlationId !== 'string') continue;
    ids.add(message.metadata.correlationId);
  }
  return [...ids];
}

function stateFor(state: Record<string, unknown>): BudgetState {
  const existing = state[BUDGET_STATE_KEY];
  if (existing && typeof existing === 'object') return existing as BudgetState;
  const created: BudgetState = { emittedLevels: {} };
  state[BUDGET_STATE_KEY] = created;
  return created;
}

export class ReminderResearchBudgetProcessor {
  readonly id = 'subconscious-remind-budget';

  constructor(
    private readonly registry: RemindRequestRegistry,
    private readonly conversation: RemindConversation,
  ) {}

  processInputStep(args: ProcessInputStepArgs): void {
    const budgetState = stateFor(args.state);
    budgetState.pendingNudge = undefined;

    const candidate = correlationIds(args.messages)
      .map(correlationId => this.registry.get(correlationId))
      .filter(
        record =>
          record?.status === 'pending' &&
          record.conversation.remindThreadId === this.conversation.remindThreadId &&
          record.conversation.resourceId === this.conversation.resourceId,
      )
      .sort((a, b) => a!.createdAt - b!.createdAt)
      .find(record => {
        const level = Math.min(MAX_LEVEL, Math.floor((Date.now() - record!.createdAt) / NUDGE_INTERVAL_MS));
        return level > (budgetState.emittedLevels[record!.correlationId] ?? 0);
      });

    if (!candidate) return;
    const level = Math.min(MAX_LEVEL, Math.floor((Date.now() - candidate.createdAt) / NUDGE_INTERVAL_MS));
    budgetState.pendingNudge = {
      correlationId: candidate.correlationId,
      level,
      transient: true,
      contents: nudgeText(level, Math.floor((Date.now() - candidate.createdAt) / 1000)),
    };
  }

  processLLMRequest(args: ProcessLLMRequestArgs): ProcessLLMRequestResult {
    const budgetState = stateFor(args.state);
    const nudge = budgetState.pendingNudge;
    if (!nudge) return undefined;

    const record = this.registry.get(nudge.correlationId);
    budgetState.pendingNudge = undefined;
    if (!record || record.status !== 'pending') return undefined;

    budgetState.emittedLevels[nudge.correlationId] = nudge.level;
    return {
      prompt: [...args.prompt, { role: 'system', content: nudge.contents }],
    };
  }
}
