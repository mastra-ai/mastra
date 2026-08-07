/**
 * DurableAgent messageId rotation between iterations
 *
 * The non-durable agentic loop rotates the per-iteration messageId so each
 * iteration's assistant message lands under a distinct id. The durable
 * `dowhile` predicate must do the same; otherwise downstream consumers
 * (memory persistence, downstream replay, audit logs, signal drains) cannot
 * tell which assistant content was produced in which iteration.
 *
 * Rotation happens inside the `dowhile` predicate by calling
 * `mastra.generateId()` (with a `randomUUID()` fallback). The cleanest
 * verifiable surface is to install a deterministic `idGenerator` on the
 * Mastra instance and assert it is invoked at the iteration boundary, and
 * that the rotated id flows into the workflow state for the next iteration.
 */

import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Mastra } from '../../../mastra';
import { MockMemory } from '../../../memory/mock';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';

function createToolThenTextModel(toolName: string, toolArgs: object, finalText: string) {
  let callCount = 0;
  return new MockLanguageModelV2({
    doStream: async () => {
      callCount += 1;
      const stream: ReadableStream<any> =
        callCount === 1
          ? convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: `id-${callCount}`, modelId: 'mock-model-id', timestamp: new Date(0) },
              {
                type: 'tool-call',
                toolCallType: 'function',
                toolCallId: `call-${callCount}`,
                toolName,
                input: JSON.stringify(toolArgs),
                providerExecuted: false,
              },
              {
                type: 'finish',
                finishReason: 'tool-calls',
                usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
              },
            ])
          : convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: `id-${callCount}`, modelId: 'mock-model-id', timestamp: new Date(0) },
              { type: 'text-start', id: 'text-1' },
              { type: 'text-delta', id: 'text-1', delta: finalText },
              { type: 'text-end', id: 'text-1' },
              {
                type: 'finish',
                finishReason: 'stop',
                usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
              },
            ]);
      return { stream, rawCall: { rawPrompt: null, rawSettings: {} }, warnings: [] };
    },
  });
}

describe('DurableAgent messageId rotation between iterations', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  it('invokes mastra.generateId() in the dowhile predicate when continuing to the next iteration', async () => {
    const model = createToolThenTextModel('weatherTool', { location: 'Toronto' }, 'It is sunny.');

    const weatherTool = createTool({
      id: 'weatherTool',
      description: 'Get weather for a location',
      inputSchema: z.object({ location: z.string() }),
      execute: async () => ({ temperature: 20, conditions: 'sunny' }),
    });

    let counter = 0;
    const generated: string[] = [];
    const idGenerator = vi.fn(() => {
      counter += 1;
      const id = `rotated-msg-${counter}`;
      generated.push(id);
      return id;
    });

    const memory = new MockMemory();
    const baseAgent = new Agent({
      id: 'msgid-rotation-agent',
      name: 'MsgId Rotation Agent',
      instructions: 'Get weather information.',
      model: model as LanguageModelV2,
      tools: { weatherTool },
      memory,
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });
    // Attach the deterministic generator to the Mastra instance the durable
    // workflow reads from when rotating. The Mastra constructor wires
    // `idGenerator` onto every registered agent, so `mastra.generateId()`
    // inside the dowhile predicate returns the rotated IDs below.
    new Mastra({
      agents: { 'msgid-rotation-agent': durableAgent },
      idGenerator,
      logger: false,
    });

    const result = await durableAgent.stream('Weather in Toronto?', {
      memory: { thread: 'thread-rotation', resource: 'resource-rotation' },
    });
    for await (const _chunk of result.fullStream) {
      // Drain
    }
    await result.output.getFullOutput();
    result.cleanup();

    // `mastra.generateId()` is the shared id factory; the dowhile predicate
    // is one of several callers. Assert the boundary effect rather than a
    // call count: the predicate must call it at least once between
    // iterations, and the rotated id must reach iteration 2's assistant
    // message in persisted memory.
    expect(generated.length).toBeGreaterThan(0);

    const persisted = await memory.recall({
      threadId: 'thread-rotation',
      resourceId: 'resource-rotation',
    });
    const assistantIds = persisted.messages.filter(m => m.role === 'assistant').map(m => m.id);
    // Two iterations should produce two distinct assistant messages once the
    // predicate marks the response boundary alongside rotating messageId.
    expect(assistantIds.length).toBeGreaterThanOrEqual(2);
    expect(new Set(assistantIds).size).toBeGreaterThanOrEqual(2);
    // At least one assistant message id must have been minted by the
    // instrumented generator — the rotation boundary.
    const matched = assistantIds.filter(id => generated.includes(id));
    expect(matched.length).toBeGreaterThan(0);
  });
});
