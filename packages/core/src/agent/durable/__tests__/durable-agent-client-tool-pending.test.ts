/**
 * Reproduction for issue #23295 on the DURABLE agent engine (end-to-end).
 *
 * A tool declared without `execute` is answered by the client on a follow-up request, so a
 * durable agent turn must end at that call. Before this fix the durable mapping step
 * recorded an empty result for it and let the loop continue, so the model was invoked a
 * second time on a tool output nobody had produced — the agent answered as though the
 * client tool had returned nothing, and the client never got the chance to answer.
 *
 * The mapping-step-level behaviour is pinned in
 * ../workflows/steps/llm-mapping-pending-client-tool.test.ts; these tests cover the
 * observable agent surface: model call count, streamed chunks, and the client resume.
 */

import type { LanguageModelV2, LanguageModelV2CallOptions } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { z } from 'zod';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Mastra } from '../../../mastra';
import { InMemoryStore } from '../../../storage';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';

const USAGE = { inputTokens: 10, outputTokens: 20, totalTokens: 30 };
const TOOL_CALL_ID = 'tc-1';

/**
 * Model that requests the client-executed tool on the first call, then answers in text once
 * the client's result comes back on a follow-up request. `modelCalls` counts invocations so
 * the tests can assert the loop stopped instead of re-invoking the model.
 */
function createClientToolModel(finalText: string) {
  let callCount = 0;
  const prompts: LanguageModelV2CallOptions['prompt'][] = [];
  const model = new MockLanguageModelV2({
    doStream: async options => {
      callCount++;
      prompts.push(options.prompt);
      if (callCount === 1) {
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'resp-1', modelId: 'mock', timestamp: new Date(0) },
            {
              type: 'tool-call',
              toolCallType: 'function',
              toolCallId: TOOL_CALL_ID,
              toolName: 'client-tool',
              input: '{"label":"Done"}',
            },
            { type: 'finish', finishReason: 'tool-calls', usage: USAGE },
          ]),
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
        };
      }

      return {
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'resp-2', modelId: 'mock', timestamp: new Date(0) },
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: finalText },
          { type: 'text-end', id: 'text-1' },
          { type: 'finish', finishReason: 'stop', usage: USAGE },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      };
    },
  }) as unknown as LanguageModelV2;

  return { model, modelCalls: () => callCount, prompts };
}

describe('issue #23295 (durable engine): the loop stops at a client-executed tool call', () => {
  let _mastra: Mastra;
  let pubsub: EventEmitterPubSub;

  afterEach(async () => {
    vi.restoreAllMocks();
    await _mastra?.close?.();
    pubsub?.removeAllListeners?.();
  });

  function createAgent(finalText = 'client answered') {
    pubsub = new EventEmitterPubSub();
    const { model, modelCalls, prompts } = createClientToolModel(finalText);

    const baseAgent = new Agent({
      id: 'test-agent',
      name: 'test-agent',
      instructions: 'You are a test agent',
      model,
      tools: {
        // Execute-less: the tool runs on the client and the server only observes the result.
        'client-tool': createTool({
          id: 'client-tool',
          description: 'A client-side tool',
          inputSchema: z.object({ label: z.string() }),
        }),
      },
    });

    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

    _mastra = new Mastra({
      agents: { 'test-agent': durableAgent },
      storage: new InMemoryStore(),
    });

    return { durableAgent, modelCalls, prompts };
  }

  it('ends the run at the client tool call and leaves it unanswered', async () => {
    const { durableAgent, modelCalls } = createAgent();

    const { output } = await durableAgent.stream('test prompt', { maxSteps: 5 });

    const types: string[] = [];
    for await (const chunk of output.fullStream) {
      types.push(chunk.type);
    }

    // The model is called once: the turn ends at the pending call rather than looping back
    // with a result nobody produced.
    expect(modelCalls()).toBe(1);

    // The call reaches the client so it can be executed...
    expect(types).toContain('tool-call');
    expect(types.filter(type => type === 'step-start')).toHaveLength(1);

    // ...but no fabricated result is streamed for it.
    expect(types).not.toContain('tool-result');

    expect(await output.finishReason).toBe('tool-calls');

    // Public step content (what `onStepFinish` / `output.steps` consumers see) must not show
    // a completed result for a call the client never answered.
    const steps = await output.steps;
    expect(steps).toHaveLength(1);
    expect(steps[0]!.content.some(part => part.type === 'tool-call')).toBe(true);
    expect(steps[0]!.content.some(part => part.type === 'tool-result')).toBe(false);
  });

  it('continues when the client result arrives on a follow-up request', async () => {
    const { durableAgent, modelCalls, prompts } = createAgent('client answered');

    const first = await durableAgent.stream('test prompt', { maxSteps: 5 });
    await first.output.consumeStream();
    expect(modelCalls()).toBe(1);

    // Follow-up request shape from @mastra/client-js: previous assistant tool-call + the
    // client-produced tool result.
    const second = await durableAgent.stream(
      [
        { role: 'user', content: [{ type: 'text', text: 'test prompt' }] },
        {
          role: 'assistant',
          content: [{ type: 'tool-call', toolCallId: TOOL_CALL_ID, toolName: 'client-tool', args: { label: 'Done' } }],
        },
        {
          role: 'tool',
          content: [
            { type: 'tool-result', toolCallId: TOOL_CALL_ID, toolName: 'client-tool', result: { confirmed: true } },
          ],
        },
      ] satisfies Parameters<typeof durableAgent.stream>[0],
      { maxSteps: 2 },
    );
    await second.output.consumeStream();

    // Ending the turn must leave the run resumable, not dead-ended.
    expect(await second.output.text).toBe('client answered');
    expect(modelCalls()).toBe(2);

    // The resumed model request carries the client's real result for the pending call, not
    // the fabricated empty result the old loop produced.
    const toolMessages = prompts[1]!.filter(message => message.role === 'tool');
    expect(toolMessages).toHaveLength(1);
    const toolResult = toolMessages[0]!.content.find(
      part => part.type === 'tool-result' && part.toolCallId === TOOL_CALL_ID,
    );
    expect(toolResult).toBeDefined();
    expect(JSON.stringify(toolResult)).toContain('"confirmed":true');
  });
});
