import { describe, expectTypeOf, it } from 'vitest';
import type { AgentAbortThreadOptions } from '../types';
import type { DurableAgent } from './durable-agent';

declare const agent: DurableAgent;

describe('durable thread abort options', () => {
  it('accepts clearPendingSignals inline and preserves the base options', () => {
    expectTypeOf(agent.abortThreadStream).parameter(0).toEqualTypeOf<AgentAbortThreadOptions>();
    expectTypeOf(agent.abortThreadStream({ threadId: 'thread', clearPendingSignals: true })).toEqualTypeOf<boolean>();
    expectTypeOf(agent.abortThreadStream({ threadId: 'thread' })).toEqualTypeOf<boolean>();
  });
});
