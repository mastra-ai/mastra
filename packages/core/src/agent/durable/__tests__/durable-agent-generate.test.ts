/**
 * DurableAgent.generate / DurableAgent.resumeGenerate
 *
 * Parity sanity for the non-streaming convenience wrappers. The wrappers run
 * the exact same durable workflow as `stream()` / `resume()` and just drain
 * the underlying `MastraModelOutput` into the shared `FullOutput` shape, so
 * the tests focus on:
 *
 *  - generate → suspend (requireToolApproval) → resumeGenerate round-trip,
 *    with both the Agent and the deprecated argument order
 *  - cleanup happens (registry entry removed) on success
 *
 * FullOutput text/usage and error rethrow run on every engine in the aimock
 * scenarios usage-reporting and callbacks-default-options.
 */
import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { z } from 'zod';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Mastra } from '../../../mastra';
import { MockStore } from '../../../storage/mock';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';
import { globalRunRegistry } from '../run-registry';

function createTextModel(text: string) {
  return new MockLanguageModelV2({
    doGenerate: async () => ({
      content: [{ type: 'text', text }],
      finishReason: 'stop',
      usage: { inputTokens: 7, outputTokens: 11, totalTokens: 18 },
      warnings: [],
    }),
  });
}

function createToolCallThenTextModel(toolName: string, args: Record<string, unknown>, finalText: string) {
  let callCount = 0;
  return new MockLanguageModelV2({
    doGenerate: async () => {
      callCount++;
      if (callCount === 1) {
        return {
          content: [
            {
              type: 'tool-call' as const,
              toolCallType: 'function' as const,
              toolCallId: 'call-1',
              toolName,
              input: JSON.stringify(args),
            },
          ],
          finishReason: 'tool-calls' as const,
          usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 },
          warnings: [],
        };
      }
      return {
        content: [{ type: 'text' as const, text: finalText }],
        finishReason: 'stop' as const,
        usage: { inputTokens: 10, outputTokens: 9, totalTokens: 19 },
        warnings: [],
      };
    },
  });
}

describe('DurableAgent.generate()', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  // generate() keeps its run observable by run ID for the cleanup window, like
  // stream(), and must still release it afterwards or every call leaks.
  it('releases the run after the cleanup window', async () => {
    const model = createTextModel('done');
    const baseAgent = new Agent({
      id: 'generate-cleanup-agent',
      name: 'Generate Cleanup Agent',
      instructions: 'Be brief.',
      model: model as LanguageModelV2,
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub, cleanupTimeoutMs: 50 });

    const out = await durableAgent.generate('hi');

    expect(globalRunRegistry.get(out.runId!)).toBeDefined();
    await vi.waitFor(() => expect(globalRunRegistry.get(out.runId!)).toBeUndefined());
  });

  // With the timer disabled nothing would ever release a generate() run: its
  // caller gets only the result, never a cleanup handle.
  it('releases the run on return when the cleanup timer is disabled', async () => {
    const model = createTextModel('done');
    const baseAgent = new Agent({
      id: 'generate-no-timer-agent',
      name: 'Generate No Timer Agent',
      instructions: 'Be brief.',
      model: model as LanguageModelV2,
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub, cleanupTimeoutMs: 0 });

    const out = await durableAgent.generate('hi');

    expect(globalRunRegistry.get(out.runId!)).toBeUndefined();
  });
});

describe('DurableAgent.resumeGenerate()', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  it.each([
    ['Agent order: resumeGenerate(resumeData, { runId })', 'agent'],
    ['deprecated order: resumeGenerate(runId, resumeData)', 'legacy'],
  ] as const)('drives a generate → tool-approval suspend → resumeGenerate round-trip (%s)', async (_label, order) => {
    const model = createToolCallThenTextModel('searchTool', { query: 'mastra' }, 'Found: mastra');
    const searchTool = createTool({
      id: 'searchTool',
      description: 'Search for information',
      inputSchema: z.object({ query: z.string() }),
      execute: async () => ({ results: ['mastra'] }),
    });

    const baseAgent = new Agent({
      id: 'generate-resume-agent',
      name: 'Generate Resume Agent',
      instructions: 'Use the search tool when asked.',
      model: model as LanguageModelV2,
      tools: { searchTool },
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

    // Register with Mastra so the durable workflow has a storage backend
    // to persist the suspended snapshot resumeGenerate needs to re-enter.
    new Mastra({
      logger: false,
      storage: new MockStore(),
      agents: { 'generate-resume-agent': durableAgent as any },
    });

    // First turn: tool call requires approval → suspends.
    const first = await durableAgent.generate('search for mastra', {
      requireToolApproval: true,
    });

    // On suspend the durable adapter closes the stream early with the
    // suspended finish reason so callers can detect the pause and resume.
    expect(first.finishReason).toBe('suspended');
    expect(first.runId).toBeDefined();

    // Second turn: approve and drain to a final answer via resumeGenerate.
    // Code typed against the base `Agent` must be able to resume a durable agent.
    const second =
      order === 'agent'
        ? await (durableAgent as unknown as Agent).resumeGenerate({ approved: true }, { runId: first.runId! })
        : await durableAgent.resumeGenerate(first.runId!, { approved: true });

    expect(second.text).toBe('Found: mastra');
    expect(second.finishReason).toBe('stop');
    expect(second.error).toBeUndefined();
  });
});
