import type { ComputeStateSignalArgs, ComputeStateSignalResult } from '@mastra/core/processors';

import type { BehaviorPath, BehaviorResolver } from '../definition/resolver.js';
import type { BehaviorRuntimeStore } from './types.js';

function lp(value: string): string { return `${value.length}:${value}`; }

export class BehaviorStateProcessor {
  readonly id: string;
  readonly stateId: string;

  constructor(
    private readonly resolver: BehaviorResolver,
    private readonly store: BehaviorRuntimeStore,
    private readonly rememberThreadId?: (requestContext: ComputeStateSignalArgs['requestContext'], threadId: string) => void,
    private readonly initialize?: (threadId: string) => Promise<unknown>,
  ) {
    this.id = `behavior-state-${resolver.id}`;
    this.stateId = `behavior:${resolver.id}`;
  }

  async computeStateSignal(args: ComputeStateSignalArgs): Promise<ComputeStateSignalResult> {
    this.rememberThreadId?.(args.requestContext, args.threadId);
    let record = await this.store.readThread({ threadId: args.threadId, behaviorId: this.resolver.id });
    if (!record && this.initialize) {
      await this.initialize(args.threadId);
      record = await this.store.readThread({ threadId: args.threadId, behaviorId: this.resolver.id });
    }
    const prior = args.lastSnapshot?.metadata?.record as { status?: string } | undefined;
    const hasBase = Boolean(args.lastSnapshot) && args.contextWindow.hasSnapshot;
    if (!record || record.status !== 'active') {
      if (!hasBase || !prior || prior.status !== 'active') return;
      return { id: this.stateId, cacheKey: `${this.stateId}:none`, mode: 'snapshot', tagName: 'current-behavior', contents: '\n', value: { behavior: undefined }, attributes: { status: 'none' }, metadata: { record: record ?? { status: 'none' } } };
    }
    const node = await this.resolver.resolve(record.activeState as BehaviorPath);
    if (!node) return;
    const children = await this.resolver.children(node.id);
    const parentId = this.resolver.parent(node.id);
    const available = [...new Set([...children.map(child => child.id), ...(parentId ? [parentId] : [])])];
    const cacheKey = `${this.stateId}:${lp(node.version)}${lp(node.id)}${lp(available.join(','))}${lp(record.intent ?? '')}`;
    if (hasBase && args.lastSnapshot?.metadata?.state?.cacheKey === cacheKey) return;
    const contents = [
      `Behavior: ${this.resolver.id}`,
      `Path: ${node.id}`,
      node.instructions ? `Instructions:\n${node.instructions}` : undefined,
      `Available behaviors: ${available.join(', ')}`,
      record.intent ? `Current intent: ${record.intent}` : 'Current intent: not set',
    ].filter(Boolean).join('\n');
    return {
      id: this.stateId,
      cacheKey,
      mode: 'snapshot',
      tagName: 'current-behavior',
      contents: `\n${contents}\n`,
      value: { behavior: { id: this.resolver.id, version: node.version, revision: record.revision, path: node.id, status: record.status, intent: record.intent } },
      attributes: { id: this.resolver.id, state: node.id, status: record.status },
      metadata: { record: { revision: record.revision, status: record.status } },
    };
  }
}
