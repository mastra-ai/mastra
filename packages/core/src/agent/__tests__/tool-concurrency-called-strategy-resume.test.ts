import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../../mastra';
import { InMemoryStore } from '../../storage';
import { createTool } from '../../tools';
import { delay } from '../../utils';
import { Agent } from '../agent';

/**
 * Resuming a batch of suspended tool calls under the 'called' strategy must keep the
 * concurrency map-tool-calls computed for that batch. On resume that step is skipped
 * (it completed before the suspension), so the foreach used to fall back to the
 * conservative limit of 1 and ran the resumed siblings one at a time.
 *
 * Related: https://github.com/mastra-ai/mastra/issues/24581
 */

const TOOL_NAMES = ['ask-1', 'ask-2', 'ask-3'];

function supervisorModel() {
  let call = 0;
  return new MockLanguageModelV2({
    doStream: async () => {
      call += 1;
      const chunks =
        call === 1
          ? TOOL_NAMES.map((toolName, i) => ({
              type: 'tool-call' as const,
              toolCallType: 'function' as const,
              toolCallId: `call-${i}`,
              toolName,
              input: JSON.stringify({ q: `q${i}` }),
            }))
          : [
              { type: 'text-start', id: 't' },
              { type: 'text-delta', id: 't', delta: 'done' },
              { type: 'text-end', id: 't' },
            ];
      return {
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: `r${call}`, modelId: 'm', timestamp: new Date(0) },
          ...chunks,
          {
            type: 'finish',
            finishReason: call === 1 ? 'tool-calls' : 'stop',
            usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          },
        ] as any),
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      };
    },
  });
}

describe("toolCallConcurrency strategy: 'called' across resume (#24581)", () => {
  it('resumes all suspended sibling calls concurrently with the recomputed limit', async () => {
    const tracker = { running: 0, peak: 0, resumed: 0 };

    // Like sub-agent delegation tools: no suspend schema, but they suspend at runtime.
    const askTool = (id: string) =>
      createTool({
        id,
        description: id,
        inputSchema: z.object({ q: z.string() }),
        execute: async (_input, context) => {
          if (!context?.agent?.resumeData) {
            return await context?.agent?.suspend({ question: id });
          }
          tracker.running++;
          tracker.resumed++;
          tracker.peak = Math.max(tracker.peak, tracker.running);
          await delay(50);
          tracker.running--;
          return { ok: true };
        },
      });

    // Registered but never called: forces the conservative construction-time limit of 1.
    const registeredSuspendTool = createTool({
      id: 'confirm',
      description: 'confirm',
      inputSchema: z.object({ q: z.string() }),
      suspendSchema: z.object({ question: z.string() }),
      resumeSchema: z.object({ answer: z.string() }),
      execute: async () => ({ ok: true }),
    });

    const agent = new Agent({
      id: 'supervisor',
      name: 'supervisor',
      instructions: 'x',
      model: supervisorModel(),
      tools: {
        'ask-1': askTool('ask-1'),
        'ask-2': askTool('ask-2'),
        'ask-3': askTool('ask-3'),
        confirm: registeredSuspendTool,
      },
    });
    new Mastra({ agents: { agent }, logger: false, storage: new InMemoryStore() });

    const toolCallConcurrency = { limit: 3, strategy: 'called' as const };
    const stream = await agent.stream('go', { toolCallConcurrency });
    const suspended: string[] = [];
    for await (const chunk of stream.fullStream) {
      if (chunk.type === 'tool-call-suspended') suspended.push(chunk.payload.toolCallId);
    }
    expect(suspended).toHaveLength(3);

    const resumed = await agent.resumeStream({ answer: 'yes' }, { runId: stream.runId, toolCallConcurrency });
    for await (const _ of resumed.fullStream) {
      /* drain */
    }

    expect(tracker.resumed).toBe(3);
    expect(tracker.peak).toBe(3);
  });
});
