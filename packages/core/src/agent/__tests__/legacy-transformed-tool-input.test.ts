import { MockLanguageModelV1, simulateReadableStream } from '@internal/ai-sdk-v4/test';
import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { createTool } from '../../tools';
import { Agent } from '../agent';

// generateLegacy()/streamLegacy() only accept AI SDK v4 (LanguageModelV1) models,
// so this covers the legacy counterpart of the transformed-tool-input aimock scenario.

const usage = { promptTokens: 10, completionTokens: 10, totalTokens: 20 };
const rawCall = { rawPrompt: null, rawSettings: {} };

function fetchPageTool(received: unknown[]) {
  return createTool({
    id: 'fetch_page',
    description: 'Fetches a page',
    inputSchema: z.object({ url: z.string().transform(s => new URL(s)) }),
    execute: async ({ url }) => {
      received.push(url);
      return { host: url.host };
    },
  });
}

function toolCallingModel() {
  let calls = 0;
  return new MockLanguageModelV1({
    doGenerate: async () => {
      calls++;
      if (calls === 1) {
        return {
          finishReason: 'tool-calls',
          usage,
          rawCall,
          toolCalls: [
            {
              toolCallType: 'function',
              toolCallId: 'call-1',
              toolName: 'fetch_page',
              args: JSON.stringify({ url: 'https://example.com/docs' }),
            },
          ],
        };
      }
      return { text: 'done', finishReason: 'stop', usage, rawCall };
    },
    doStream: async () => {
      calls++;
      const chunks: any[] =
        calls === 1
          ? [
              {
                type: 'tool-call',
                toolCallType: 'function',
                toolCallId: 'call-1',
                toolName: 'fetch_page',
                args: JSON.stringify({ url: 'https://example.com/docs' }),
              },
              { type: 'finish', finishReason: 'tool-calls', usage },
            ]
          : [
              { type: 'text-delta', textDelta: 'done' },
              { type: 'finish', finishReason: 'stop', usage },
            ];
      return { stream: simulateReadableStream({ chunks }), rawCall };
    },
  });
}

describe('legacy agent tool calls with a transforming input schema', () => {
  it('generateLegacy runs the tool with the decoded input', async () => {
    const received: unknown[] = [];
    const agent = new Agent({
      id: 'legacy-transform',
      name: 'legacy-transform',
      instructions: 'Fetch pages.',
      model: toolCallingModel(),
      tools: { fetch_page: fetchPageTool(received) },
    });

    const result = await agent.generateLegacy('Fetch example.com', { maxSteps: 2 });

    expect(received).toHaveLength(1);
    expect(received[0]).toBeInstanceOf(URL);
    expect(result.steps[0]!.toolResults).toEqual([expect.objectContaining({ result: { host: 'example.com' } })]);
    expect(result.text).toBe('done');
  });

  it('streamLegacy runs the tool with the decoded input', async () => {
    const received: unknown[] = [];
    const agent = new Agent({
      id: 'legacy-transform-stream',
      name: 'legacy-transform-stream',
      instructions: 'Fetch pages.',
      model: toolCallingModel(),
      tools: { fetch_page: fetchPageTool(received) },
    });

    const result = await agent.streamLegacy('Fetch example.com', { maxSteps: 2 });
    let text = '';
    for await (const chunk of result.textStream) {
      text += chunk;
    }

    expect(received).toHaveLength(1);
    expect(received[0]).toBeInstanceOf(URL);
    expect(text).toBe('done');
  });
});
