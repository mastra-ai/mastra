/**
 * Regression test for #26514: when the model makes several tool calls in one
 * step and one of them suspends, the sibling calls that already finished lost
 * their results. The suspension kills the tool-call foreach, so llmMappingStep
 * (the only place that emits and commits tool-results) never runs for the
 * step. Memory kept the finished sibling as `state: "call"`, incomplete-call
 * filtering then removed it from every later prompt, and an auto-resume turn
 * re-called only the suspended tool — the sibling's work silently vanished.
 *
 * A completed sibling's result must be committed and persisted when the step
 * suspends, so the next model call (any resume path) sees its call AND result.
 */
import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../../mastra';
import { MockMemory } from '../../memory/mock';
import { InMemoryStore } from '../../storage';
import { createTool } from '../../tools';
import { Agent } from '../agent';

const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };

describe('a suspending tool call does not drop finished sibling results (#26514)', () => {
  it('commits and persists the finished sibling result when the step suspends', async () => {
    const prompts: unknown[][] = [];
    let call = 0;
    const model = new MockLanguageModelV2({
      doStream: async ({ prompt }) => {
        call += 1;
        prompts.push(prompt as unknown[]);
        const chunks =
          call === 1
            ? [
                {
                  type: 'tool-call' as const,
                  toolCallType: 'function' as const,
                  toolCallId: 'call-weather',
                  toolName: 'getWeather',
                  input: JSON.stringify({ city: 'Lisbon' }),
                },
                {
                  type: 'tool-call' as const,
                  toolCallType: 'function' as const,
                  toolCallId: 'call-book',
                  toolName: 'bookTable',
                  input: JSON.stringify({ guests: 2 }),
                },
              ]
            : [
                { type: 'text-start' as const, id: 't' },
                { type: 'text-delta' as const, id: 't', delta: 'done' },
                { type: 'text-end' as const, id: 't' },
              ];
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: `r${call}`, modelId: 'm', timestamp: new Date(0) },
            ...chunks,
            {
              type: 'finish',
              finishReason: call === 1 ? 'tool-calls' : 'stop',
              usage,
            },
          ] as any),
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
        };
      },
    });

    const getWeather = createTool({
      id: 'getWeather',
      description: 'weather',
      inputSchema: z.object({ city: z.string() }),
      execute: async () => ({ tempF: 72 }),
    });
    const bookTable = createTool({
      id: 'bookTable',
      description: 'book',
      inputSchema: z.object({ guests: z.number() }),
      suspendSchema: z.object({ question: z.string() }),
      resumeSchema: z.object({ confirmed: z.boolean() }),
      execute: async (_input, context) => {
        if (!context?.agent?.resumeData) {
          return await context?.agent?.suspend({ question: 'which time?' });
        }
        return { booked: true };
      },
    });

    const storage = new InMemoryStore();
    const memory = new MockMemory({ storage });
    const agent = new Agent({
      id: 'sibling-agent',
      name: 'Sibling Agent',
      instructions: 'x',
      model,
      memory,
      tools: { getWeather, bookTable },
    });
    new Mastra({ agents: { agent }, logger: false, storage });

    const threadId = 'thread-1';
    const resourceId = 'user-1';

    // Turn 1: getWeather runs to completion, then bookTable suspends the step.
    const stream = await agent.stream('weather in Lisbon, then book a table', {
      memory: { thread: threadId, resource: resourceId },
    });
    for await (const _chunk of stream.fullStream) {
      // drain
    }
    expect(stream.status).toBe('suspended');

    // The finished sibling's result must be persisted — not left as a bare call.
    const recalled = await memory.recall({ threadId, resourceId, perPage: 50 } as any);
    const toolParts = recalled.messages
      .flatMap((message: any) => message.content?.parts ?? [])
      .filter((part: any) => part.type === 'tool-invocation')
      .map((part: any) => ({ toolName: part.toolInvocation.toolName, state: part.toolInvocation.state }));
    expect(toolParts).toContainEqual({ toolName: 'getWeather', state: 'result' });

    const weatherPart = recalled.messages
      .flatMap((message: any) => message.content?.parts ?? [])
      .find((part: any) => part.type === 'tool-invocation' && part.toolInvocation.toolName === 'getWeather');
    expect(weatherPart.toolInvocation.result).toEqual({ tempF: 72 });

    // Turn 2 (auto-resume): the next model call must see the sibling's call and result.
    const stream2 = await agent.stream('book it for 8pm', {
      memory: { thread: threadId, resource: resourceId },
      autoResumeSuspendedTools: true,
    });
    for await (const _chunk of stream2.fullStream) {
      // drain
    }

    const turn2Prompt = JSON.stringify(prompts[1] ?? []);
    expect(turn2Prompt).toContain('call-weather');
    expect(turn2Prompt).toContain('tempF');
  }, 30000);
});
