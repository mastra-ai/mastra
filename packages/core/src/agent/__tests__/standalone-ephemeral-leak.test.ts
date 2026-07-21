/**
 * Regression tests for #19404: standalone Agent ephemeral Mastra leaked its
 * scorer hook on the module-level mitt emitter.
 *
 * A standalone Agent (not attached to a Mastra via `{ agents }`) creates an
 * ephemeral Mastra on first `stream()`/`generate()` call. Before the fix, the
 * ephemeral Mastra's constructor registered an ON_SCORER_RUN handler on the
 * module-level emitter that was never deregistered, so the emitter retained
 * the whole ephemeral graph for the process lifetime — one leaked Mastra per
 * discarded standalone Agent.
 *
 * The fix suppresses hook registration for ephemeral instances entirely
 * (`__ephemeral: true`): the hook could never resolve a scorer on a
 * registry-less instance anyway. These tests assert on the module-level
 * handler count (`__hookHandlerCount`), so they fail if any standalone code
 * path — including post-execution rebuilds like title generation — registers
 * a handler it doesn't release.
 */
import { describe, expect, it, vi } from 'vitest';
import { __hookHandlerCount, AvailableHooks } from '../../hooks';
import { MockMemory } from '../../memory/mock';
import { Agent } from '../agent';
import type { AgentExecutionOptions } from '../agent.types';
import { convertArrayToReadableStream, MockLanguageModelV2 } from './mock-model';

function makeMockModel() {
  return new MockLanguageModelV2({
    doStream: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-1', modelId: 'mock', timestamp: new Date(0) },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: 'ok' },
        { type: 'text-end', id: 'text-1' },
        { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
      ]),
    }),
  });
}

function scorerHookCount() {
  return __hookHandlerCount(AvailableHooks.ON_SCORER_RUN);
}

async function streamAndDrain(agent: Agent, prompt: string, options?: AgentExecutionOptions) {
  const result = options ? await agent.stream(prompt, options) : await agent.stream(prompt);
  for await (const _ of result.fullStream) {
    // drain
  }
}

describe('standalone Agent ephemeral Mastra hook leak (#19404)', () => {
  it('standalone stream() does not register a module-level scorer hook', async () => {
    const baseline = scorerHookCount();

    const agent = new Agent({
      id: 'standalone-leak-test',
      name: 'Standalone Leak Test',
      instructions: 'You answer.',
      model: makeMockModel(),
    });

    await streamAndDrain(agent, 'hello');

    // The ephemeral Mastra created for this call must not have registered a
    // handler on the module-level emitter — that handler is what pinned the
    // ephemeral graph against GC before the fix.
    expect(scorerHookCount()).toBe(baseline);
  });

  it('sequential standalone Agents do not accumulate handlers', async () => {
    const baseline = scorerHookCount();

    // One Agent per "request", each used once then discarded — the usage
    // pattern from the issue's repro (linear heap growth before the fix).
    for (let i = 0; i < 5; i++) {
      const agent = new Agent({
        id: `seq-agent-${i}`,
        name: `Sequential Agent ${i}`,
        instructions: 'You answer.',
        model: makeMockModel(),
      });
      await streamAndDrain(agent, `question ${i}`);
    }

    expect(scorerHookCount()).toBe(baseline);
  });

  it('standalone Agent with memory does not leak via post-stream title generation', async () => {
    const baseline = scorerHookCount();

    // Title generation runs after #execute() finishes and rebuilds the
    // ephemeral Mastra (#getOrCreateEphemeralMastra). A teardown-based fix
    // that only cleans up in #execute()'s finally block misses this rebuild —
    // this test pins the constructor-level guard instead.
    const titleModel = new MockLanguageModelV2({
      doGenerate: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop',
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        content: [{ type: 'text', text: 'Generated Title' }],
        warnings: [],
      }),
      doStream: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'title-1', modelId: 'mock', timestamp: new Date(0) },
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: 'Generated Title' },
          { type: 'text-end', id: 'text-1' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
        ]),
      }),
    });

    const memory = new MockMemory();
    memory.getMergedThreadConfig = () => ({ generateTitle: { model: titleModel } });

    const agent = new Agent({
      id: 'title-gen-leak-test',
      name: 'Title Gen Leak Test',
      instructions: 'You answer.',
      model: makeMockModel(),
      memory,
    });

    await streamAndDrain(agent, 'hello', {
      memory: {
        resource: 'user-1',
        thread: { id: 'title-gen-thread', title: '' }, // empty title triggers generation
      },
    });

    // Wait for the fire-and-forget title generation to complete.
    await vi.waitFor(async () => {
      const thread = await memory.getThreadById({ threadId: 'title-gen-thread' });
      expect(thread?.title).toBeTruthy();
      expect(thread?.title).not.toBe('');
    });

    expect(scorerHookCount()).toBe(baseline);
  });

  it('a real Mastra still registers exactly one scorer hook (scorer persistence unaffected)', async () => {
    const { Mastra } = await import('../../mastra');
    const { InMemoryStore } = await import('../../storage');

    const baseline = scorerHookCount();

    const agent = new Agent({
      id: 'attached-agent',
      name: 'Attached Agent',
      instructions: 'You answer.',
      model: makeMockModel(),
    });

    const mastra = new Mastra({
      agents: { attached: agent },
      storage: new InMemoryStore(),
    });

    // Only the real Mastra's handler — the attached Agent must not create an
    // ephemeral Mastra (and could not register a handler even if it did).
    expect(scorerHookCount()).toBe(baseline + 1);

    await streamAndDrain(agent, 'hello');
    expect(scorerHookCount()).toBe(baseline + 1);

    mastra.__unregisterHooks();
    expect(scorerHookCount()).toBe(baseline);
  });
});
