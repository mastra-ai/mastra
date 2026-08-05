/**
 * Tests for the `durable` flag on AgentConfig.
 *
 * When a user constructs `new Agent({ durable: true | { ... } })` and
 * registers it on a `Mastra` instance, the agent is auto-wrapped with
 * `createDurableAgent` in `Mastra.addAgent` — no manual factory call
 * needed.
 *
 * When the agent is used standalone (no `Mastra` registration), calls to
 * `agent.stream()` / `agent.generate()` lazily route through a
 * `DurableAgent` wrapper so the durable execution path is still used.
 */

import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, it, expect, vi } from 'vitest';
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
  it('auto-wraps `durable: true` at Mastra registration', () => {
    const raw = new Agent({
      id: 'a',
      name: 'A',
      instructions: 'test',
      model: makeMockModel(),
      durable: true,
    });
    // Before registration, the raw agent is still a plain Agent instance
    // (not a real `DurableAgent`), but it satisfies the `isDurableAgentLike`
    // duck-type via a self-referential `.agent` getter so external
    // consumers can treat it as durable-capable.
    expect(isDurableAgent(raw as any)).toBe(false);
    expect(isDurableAgentLike(raw)).toBe(true);
    // The self-referential shape: `agent.agent === agent` distinguishes the
    // placeholder from a real wrapper (which points `.agent` at a distinct
    // inner Agent).
    expect((raw as any).agent).toBe(raw);

    const mastra = new Mastra({ agents: { a: raw as any } });

    const registered = mastra.getAgent('a' as any) as unknown as DurableAgent;
    expect(isDurableAgent(registered)).toBe(true);
    expect(isDurableAgentLike(registered)).toBe(true);
    // Registration swapped the placeholder for a real wrapper whose
    // `.agent` points to the underlying raw Agent, not itself.
    expect(registered.agent).toBe(raw);
    expect(registered.agent).not.toBe(registered);
  });

  it('exposes self-referential `agent` getter only when `durable` is set', () => {
    const nonDurable = new Agent({
      id: 'non-durable',
      name: 'NonDurable',
      instructions: 'test',
      model: makeMockModel(),
    });
    expect((nonDurable as any).agent).toBeUndefined();
    expect(isDurableAgentLike(nonDurable)).toBe(false);

    const durable = new Agent({
      id: 'durable',
      name: 'Durable',
      instructions: 'test',
      model: makeMockModel(),
      durable: true,
    });
    expect((durable as any).agent).toBe(durable);
    expect(isDurableAgentLike(durable)).toBe(true);
  });

  it('forwards options object to createDurableAgent at registration', () => {
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

  it('does not double-wrap when registering an already-durable agent', async () => {
    const { createDurableAgent } = await import('../create-durable-agent');
    const inner = new Agent({
      id: 'e',
      name: 'E',
      instructions: 'test',
      model: makeMockModel(),
    });
    const wrapper = createDurableAgent({ agent: inner });

    const mastra1 = new Mastra({ agents: { e: wrapper as any } });
    const registered1 = mastra1.getAgent('e' as any) as unknown as DurableAgent;
    expect(isDurableAgent(registered1)).toBe(true);
    expect(registered1).toBe(wrapper);

    // Re-registering the same wrapper instance must also not wrap it again.
    const mastra2 = new Mastra({ agents: { e: registered1 as any } });
    const registered2 = mastra2.getAgent('e' as any) as unknown as DurableAgent;
    expect(isDurableAgent(registered2)).toBe(true);
    expect(registered2).toBe(wrapper);
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

    mastra.addAgent(raw as any, 'f');

    const registered = mastra.getAgent('f' as any) as unknown as DurableAgent;
    expect(isDurableAgent(registered)).toBe(true);
  });

  it('standalone `new Agent({ durable: true }).stream()` routes through DurableAgent', async () => {
    const { DurableAgent } = await import('../durable-agent');

    const agent = new Agent({
      id: 'stream-a',
      name: 'StreamA',
      instructions: 'test',
      model: makeMockModel(),
      durable: true,
    });

    // Spy on `DurableAgent.prototype.stream` — the lazy wrapper the Agent
    // builds on first `.stream()` call is a DurableAgent, so the call
    // dispatches through this method.
    const spy = vi.spyOn(DurableAgent.prototype as any, 'stream').mockImplementation(async () => 'durable-result');

    try {
      const result = await (agent.stream('hi') as unknown as Promise<string>);
      expect(result).toBe('durable-result');
      expect(spy).toHaveBeenCalledTimes(1);
    } finally {
      spy.mockRestore();
    }
  });

  it('standalone `new Agent({ durable: true }).generate()` routes through DurableAgent', async () => {
    const { DurableAgent } = await import('../durable-agent');

    const agent = new Agent({
      id: 'gen-a',
      name: 'GenA',
      instructions: 'test',
      model: makeMockModel(),
      durable: true,
    });

    const spy = vi
      .spyOn(DurableAgent.prototype as any, 'generate')
      .mockImplementation(async () => 'durable-generate-result');

    try {
      const result = await (agent.generate('hi') as unknown as Promise<string>);
      expect(result).toBe('durable-generate-result');
      expect(spy).toHaveBeenCalledTimes(1);
    } finally {
      spy.mockRestore();
    }
  });

  it('standalone `new Agent({ durable: true }).resumeGenerate()` routes through DurableAgent', async () => {
    const { DurableAgent } = await import('../durable-agent');

    const agent = new Agent({
      id: 'resume-gen-a',
      name: 'ResumeGenA',
      instructions: 'test',
      model: makeMockModel(),
      durable: true,
    });

    const spy = vi
      .spyOn(DurableAgent.prototype as any, 'resumeGenerate')
      .mockImplementation(async () => 'durable-resume-generate-result');

    try {
      const result = await (agent.resumeGenerate({ approved: true }, {
        runId: 'r1',
      } as any) as unknown as Promise<string>);
      expect(result).toBe('durable-resume-generate-result');
      expect(spy).toHaveBeenCalledTimes(1);
    } finally {
      spy.mockRestore();
    }
  });

  it('standalone `new Agent({ durable: true }).resumeStream()` routes through DurableAgent', async () => {
    const { DurableAgent } = await import('../durable-agent');

    const agent = new Agent({
      id: 'resume-stream-a',
      name: 'ResumeStreamA',
      instructions: 'test',
      model: makeMockModel(),
      durable: true,
    });

    const spy = vi
      .spyOn(DurableAgent.prototype as any, 'resumeStream')
      .mockImplementation(async () => 'durable-resume-stream-result');

    try {
      const result = await (agent.resumeStream({ approved: true }, {
        runId: 'r1',
      } as any) as unknown as Promise<string>);
      expect(result).toBe('durable-resume-stream-result');
      expect(spy).toHaveBeenCalledTimes(1);
    } finally {
      spy.mockRestore();
    }
  });

  it('standalone `new Agent({ durable: true }).approveToolCall()` routes through DurableAgent', async () => {
    const { DurableAgent } = await import('../durable-agent');

    const agent = new Agent({
      id: 'approve-a',
      name: 'ApproveA',
      instructions: 'test',
      model: makeMockModel(),
      durable: true,
    });

    const spy = vi
      .spyOn(DurableAgent.prototype as any, 'approveToolCall')
      .mockImplementation(async () => 'durable-approve-result');

    try {
      const result = await (agent.approveToolCall({ runId: 'r1' } as any) as unknown as Promise<string>);
      expect(result).toBe('durable-approve-result');
      expect(spy).toHaveBeenCalledTimes(1);
    } finally {
      spy.mockRestore();
    }
  });

  it('standalone `new Agent({ durable: true }).declineToolCall()` routes through DurableAgent', async () => {
    const { DurableAgent } = await import('../durable-agent');

    const agent = new Agent({
      id: 'decline-a',
      name: 'DeclineA',
      instructions: 'test',
      model: makeMockModel(),
      durable: true,
    });

    const spy = vi
      .spyOn(DurableAgent.prototype as any, 'declineToolCall')
      .mockImplementation(async () => 'durable-decline-result');

    try {
      const result = await (agent.declineToolCall({ runId: 'r1' } as any) as unknown as Promise<string>);
      expect(result).toBe('durable-decline-result');
      expect(spy).toHaveBeenCalledTimes(1);
    } finally {
      spy.mockRestore();
    }
  });

  it('standalone `new Agent({ durable: true }).streamUntilIdle()` routes through DurableAgent', async () => {
    const { DurableAgent } = await import('../durable-agent');

    const agent = new Agent({
      id: 'sui-a',
      name: 'SUIA',
      instructions: 'test',
      model: makeMockModel(),
      durable: true,
    });

    const spy = vi
      .spyOn(DurableAgent.prototype as any, 'streamUntilIdle')
      .mockImplementation(async () => 'durable-sui-result');

    try {
      const result = await (agent.streamUntilIdle('hi') as unknown as Promise<string>);
      expect(result).toBe('durable-sui-result');
      expect(spy).toHaveBeenCalledTimes(1);
    } finally {
      spy.mockRestore();
    }
  });

  it('does not lazy-wrap when a plain agent (no `durable`) calls stream', async () => {
    const { DurableAgent } = await import('../durable-agent');
    const spy = vi.spyOn(DurableAgent.prototype as any, 'stream');

    const agent = new Agent({
      id: 'plain-a',
      name: 'PlainA',
      instructions: 'test',
      model: makeMockModel(),
    });

    try {
      // We don't care about the eventual outcome — just that the durable
      // path is not entered.
      await agent.stream('hi').catch(() => {});
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it('does not lazy-wrap standalone durable agents after Mastra registration', async () => {
    const { DurableAgent } = await import('../durable-agent');

    const raw = new Agent({
      id: 'reg-a',
      name: 'RegA',
      instructions: 'test',
      model: makeMockModel(),
      durable: true,
    });

    // Registering the raw agent on a Mastra causes Mastra to build its own
    // DurableAgent wrapper. Subsequent direct calls on the raw agent must
    // no longer lazy-wrap (the raw agent's `stream` should hit the plain
    // path).
    new Mastra({ agents: { regA: raw as any } });

    const spy = vi.spyOn(DurableAgent.prototype as any, 'stream');
    try {
      await raw.stream('hi').catch(() => {});
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  describe('durable-only delegator methods on standalone Agent', () => {
    const durableMethods = [
      { name: 'resume', args: ['run-1', { input: 'data' }] as unknown[] },
      { name: 'recover', args: ['run-1'] as unknown[] },
      { name: 'listActiveRuns', args: [] as unknown[] },
      { name: 'recoverActiveRuns', args: [] as unknown[] },
      { name: 'observe', args: ['run-1'] as unknown[] },
      { name: 'prepare', args: ['hi'] as unknown[] },
    ] as const;

    for (const { name, args } of durableMethods) {
      it(`\`${name}\` routes through DurableAgent when \`durable: true\``, async () => {
        const { DurableAgent } = await import('../durable-agent');

        const agent = new Agent({
          id: `d-${name}`,
          name: `D_${name}`,
          instructions: 'test',
          model: makeMockModel(),
          durable: true,
        });

        const sentinel = { called: name };
        const spy = vi.spyOn(DurableAgent.prototype as any, name).mockImplementation(async () => sentinel);

        try {
          const result = await (agent as any)[name](...args);
          expect(result).toBe(sentinel);
          expect(spy).toHaveBeenCalledTimes(1);
          // Delegators forward positional args verbatim (plus any trailing
          // undefined options), so compare only the required prefix.
          const received = spy.mock.calls[0]!.slice(0, args.length);
          expect(received).toEqual(args);
        } finally {
          spy.mockRestore();
        }
      });

      it(`\`${name}\` throws AGENT_DURABLE_METHOD_NOT_AVAILABLE on non-durable Agent`, async () => {
        const agent = new Agent({
          id: `nd-${name}`,
          name: `ND_${name}`,
          instructions: 'test',
          model: makeMockModel(),
        });

        await expect((agent as any)[name](...args)).rejects.toThrow(
          /AGENT_DURABLE_METHOD_NOT_AVAILABLE|only available on agents constructed with `durable: true`/,
        );
      });
    }
  });

  it('exposes the raw option via the `durable` accessor on Agent', () => {
    const flag = new Agent({
      id: 'g',
      name: 'G',
      instructions: 'test',
      model: makeMockModel(),
      durable: true,
    });
    expect(flag.durable).toBe(true);

    const cache = new InMemoryServerCache();
    const opts = new Agent({
      id: 'h',
      name: 'H',
      instructions: 'test',
      model: makeMockModel(),
      durable: { cache, maxSteps: 4 },
    });
    expect(opts.durable).toEqual({ cache, maxSteps: 4 });

    const off = new Agent({
      id: 'i',
      name: 'I',
      instructions: 'test',
      model: makeMockModel(),
      durable: false,
    });
    expect(off.durable).toBe(false);

    const undef = new Agent({
      id: 'j',
      name: 'J',
      instructions: 'test',
      model: makeMockModel(),
    });
    expect(undef.durable).toBeUndefined();
  });
});
