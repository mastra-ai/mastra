import type { ComputeStateSignalArgs, ComputeStateSignalResult } from '@mastra/core/processors';

import type { NormalizedBehaviorDefinition } from '../definition/types.js';
import type { BehaviorRuntimeStore } from './types.js';

function lp(value: string): string {
  return `${value.length}:${value}`;
}

export class BehaviorStateProcessor {
  readonly id: string;
  readonly stateId: string;

  constructor(
    private readonly definition: NormalizedBehaviorDefinition,
    private readonly store: BehaviorRuntimeStore,
  ) {
    this.id = `behavior-state-${definition.id}`;
    this.stateId = `behavior:${definition.id}`;
  }

  async computeStateSignal(args: ComputeStateSignalArgs): Promise<ComputeStateSignalResult> {
    const record = await this.store.readThread({ threadId: args.threadId, behaviorId: this.definition.id });
    const prior = args.lastSnapshot?.metadata?.record as { revision?: number; status?: string } | undefined;
    const hasBase = Boolean(args.lastSnapshot) && args.contextWindow.hasSnapshot;
    if (!record || record.status !== 'active') {
      if (!hasBase || !prior || prior.status !== 'active') return;
      return {
        id: this.stateId,
        cacheKey: `${this.stateId}:none`,
        mode: 'snapshot',
        tagName: 'current-behavior',
        contents: '\n',
        value: { behavior: undefined },
        attributes: { status: 'none' },
        metadata: { record: record ?? { status: 'none' } },
      };
    }
    const state = this.definition.states[record.activeState];
    if (!state) return;
    const transitions = state.transitions.map(item => item.id).join(', ');
    const cacheKey = `${this.stateId}:${lp(String(record.revision))}${lp(record.activeState)}${lp(record.intent ?? '')}`;
    if (hasBase && args.lastSnapshot?.metadata?.state?.cacheKey === cacheKey) return;
    const contents = [
      `Behavior: ${this.definition.id}`,
      `State: ${record.activeState}`,
      state.instructions ? `Instructions:\n${state.instructions}` : undefined,
      `Available transitions: ${transitions}`,
      record.intent ? `Current intent: ${record.intent}` : 'Current intent: not set',
    ]
      .filter(Boolean)
      .join('\n');
    return {
      id: this.stateId,
      cacheKey,
      mode: 'snapshot',
      tagName: 'current-behavior',
      contents: `\n${contents}\n`,
      value: { behavior: record },
      attributes: { id: this.definition.id, state: record.activeState, status: record.status },
      metadata: { record },
    };
  }
}
