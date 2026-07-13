/**
 * Tests for the `durable` flag on AgentConfig.
 *
 * When a user constructs `new Agent({ durable: true | { ... } })` and
 * registers it on a `Mastra` instance, the agent is auto-wrapped with
 * `createDurableAgent` in `Mastra.addAgent` — no manual factory call
 * needed.
 */

import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, it, expect } from 'vitest';
import { InMemoryServerCache } from '../../../cache/inmemory';
import { Mastra } from '../../../mastra';
import { Agent } from '../../agent';
import { isDurableAgentLike } from '../../types';
import { isDurableAgent } from '../create-durable-agent';
import type { DurableAgent } from '../durable-agent';

function makeMockModel() {
  return new MockLanguageModelV2({
    doStream: async () =>
      ({
        stream: convertArrayToReadableStream([
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: 'hi' },
          { type: 'text-end', id: 'text-1' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1 } },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
      }) as any,
  }) as LanguageModelV2;
}

describe('AgentConfig.durable', () => {
  it('auto-wraps `durable: true` at registration', () => {
    const raw = new Agent({
      id: 'a',
      name: 'A',
      instructions: 'test',
      model: makeMockModel(),
      durable: true,
    });

    const mastra = new Mastra({ agents: { a: raw as any } });

    const registered = mastra.getAgent('a' as any) as unknown as DurableAgent;
    expect(isDurableAgent(registered)).toBe(true);
    expect(isDurableAgentLike(registered)).toBe(true);
    expect(registered.agent).toBe(raw);
  });

  it('forwards options object to createDurableAgent', () => {
    const cache = new InMemoryServerCache();
    const raw = new Agent({
      id: 'b',
      name: 'B',
      instructions: 'test',
      model: makeMockModel(),
      durable: { cache, maxSteps: 3, cleanupTimeoutMs: 5_000 },
    });

    const mastra = new Mastra({ agents: { b: raw as any } });

    const registered = mastra.getAgent('b' as any) as unknown as DurableAgent;
    expect(isDurableAgent(registered)).toBe(true);
    expect(registered.cache).toBe(cache);
    expect(registered.maxSteps).toBe(3);
    expect(registered.cleanupTimeoutMs).toBe(5_000);
  });

  it('does not wrap when `durable` is unset or falsy', () => {
    const undef = new Agent({
      id: 'c',
      name: 'C',
      instructions: 'test',
      model: makeMockModel(),
    });
    const off = new Agent({
      id: 'd',
      name: 'D',
      instructions: 'test',
      model: makeMockModel(),
      durable: false,
    });

    const mastra = new Mastra({ agents: { c: undef as any, d: off as any } });

    const c = mastra.getAgent('c' as any);
    const d = mastra.getAgent('d' as any);
    expect(isDurableAgent(c as any)).toBe(false);
    expect(isDurableAgentLike(c)).toBe(false);
    expect(isDurableAgent(d as any)).toBe(false);
    expect(isDurableAgentLike(d)).toBe(false);
  });

  it('does not double-wrap when an already-durable agent has `durable: true` on its inner agent', () => {
    const inner = new Agent({
      id: 'e',
      name: 'E',
      instructions: 'test',
      model: makeMockModel(),
      durable: true,
    });

    // First registration wraps once.
    const mastra1 = new Mastra({ agents: { e: inner as any } });
    const wrappedOnce = mastra1.getAgent('e' as any) as unknown as DurableAgent;
    expect(isDurableAgent(wrappedOnce)).toBe(true);

    // Re-registering the already-wrapped instance must not wrap it again.
    const mastra2 = new Mastra({ agents: { e: wrappedOnce as any } });
    const wrappedTwice = mastra2.getAgent('e' as any) as unknown as DurableAgent;
    expect(isDurableAgent(wrappedTwice)).toBe(true);
    // The inner (raw) agent is preserved — the wrapper is not itself re-wrapped.
    expect(wrappedTwice.agent).toBe(inner);
  });

  it('`mastra.addAgent(new Agent({ durable: true }))` after construction works too', () => {
    const mastra = new Mastra({});
    const raw = new Agent({
      id: 'f',
      name: 'F',
      instructions: 'test',
      model: makeMockModel(),
      durable: true,
    });

    mastra.addAgent(raw, 'f');

    const registered = mastra.getAgent('f' as any) as unknown as DurableAgent;
    expect(isDurableAgent(registered)).toBe(true);
    expect(registered.agent).toBe(raw);
  });

  it('exposes the raw option via the `durable` accessor on the base Agent', () => {
    const raw = new Agent({
      id: 'g',
      name: 'G',
      instructions: 'test',
      model: makeMockModel(),
      durable: { maxSteps: 7 },
    });

    expect(raw.durable).toEqual({ maxSteps: 7 });

    const off = new Agent({
      id: 'h',
      name: 'H',
      instructions: 'test',
      model: makeMockModel(),
    });
    expect(off.durable).toBeUndefined();
  });
});
