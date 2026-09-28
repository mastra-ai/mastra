import { APICallError } from '@internal/ai-sdk-v5';
import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { CyberRefusalHandler } from '../../processors/cyber-refusal-handler';
import { createTool } from '../../tools';
import { Agent } from '../agent';

const REFUSAL_MESSAGE =
  'This content was flagged for possible cybersecurity risk. If this seems wrong, try rephrasing.';
const RETRY_REMINDER = '<system-reminder>continue</system-reminder>';
const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };

// Shape @ai-sdk/openai throws when a Responses stream fails with `cyber_policy` before any output.
function createRefusal() {
  const frame = {
    type: 'response.failed',
    sequence_number: 2,
    response: { error: { code: 'cyber_policy', message: REFUSAL_MESSAGE } },
  };
  return new APICallError({
    message: REFUSAL_MESSAGE,
    url: 'https://api.openai.com/v1/responses',
    requestBodyValues: {},
    statusCode: 500,
    responseBody: JSON.stringify(frame),
    data: frame,
  });
}

// Shape @ai-sdk/anthropic reports when a safety classifier stops the response (`stop_reason: "refusal"`).
const anthropicCyberStop = {
  anthropic: {
    stopDetails: {
      type: 'refusal',
      category: 'cyber',
      explanation: 'This request triggered restrictions on violative cyber content.',
    },
  },
};

type Turn = { refuse: true } | { cyberStop: true; partialText?: string } | { tool: string } | { text: string };

function createScriptedModel(turns: Turn[]) {
  const prompts: any[] = [];

  const model = new MockLanguageModelV2({
    doStream: async ({ prompt }) => {
      prompts.push(prompt);
      const turn = turns[prompts.length - 1];
      if (!turn) throw new Error(`Unexpected model call #${prompts.length}`);
      if ('refuse' in turn) throw createRefusal();

      const content =
        'cyberStop' in turn
          ? [
              ...(turn.partialText
                ? [
                    { type: 'text-start' as const, id: 't' },
                    { type: 'text-delta' as const, id: 't', delta: turn.partialText },
                    { type: 'text-end' as const, id: 't' },
                  ]
                : []),
              {
                type: 'finish' as const,
                finishReason: 'content-filter' as const,
                usage,
                providerMetadata: anthropicCyberStop,
              },
            ]
          : 'tool' in turn
            ? [
                {
                  type: 'tool-call' as const,
                  toolCallId: turn.tool,
                  toolName: 'readFile',
                  input: `{"path":"${turn.tool}"}`,
                },
                { type: 'finish' as const, finishReason: 'tool-calls' as const, usage },
              ]
            : [
                { type: 'text-start' as const, id: 't' },
                { type: 'text-delta' as const, id: 't', delta: turn.text },
                { type: 'text-end' as const, id: 't' },
                { type: 'finish' as const, finishReason: 'stop' as const, usage },
              ];

      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream([
          { type: 'stream-start' as const, warnings: [] },
          { type: 'response-metadata' as const, id: `id-${prompts.length}`, modelId: 'mock', timestamp: new Date(0) },
          ...content,
        ]),
      };
    },
  });

  return { model, prompts };
}

function createAgent(model: MockLanguageModelV2) {
  return new Agent({
    id: 'cyber-refusal-agent',
    name: 'Cyber Refusal Agent',
    instructions: 'You are a coding agent',
    model: [{ model, maxRetries: 0 }],
    tools: {
      readFile: createTool({
        id: 'readFile',
        description: 'Read a file',
        inputSchema: z.object({ path: z.string() }),
        execute: async ({ path }) => `contents of ${path}`,
      }),
    },
    // Error lane for OpenAI refusals (thrown), output lane for Anthropic stops (finished steps).
    outputProcessors: [new CyberRefusalHandler()],
    errorProcessors: [new CyberRefusalHandler()],
    maxProcessorRetries: 3,
  });
}

function countReminders(prompt: any[]) {
  return prompt.filter(
    msg =>
      msg.role === 'user' &&
      Array.isArray(msg.content) &&
      msg.content.some((part: any) => part.type === 'text' && part.text === RETRY_REMINDER),
  ).length;
}

// Mastra stamps `providerOptions.mastra.createdAt` on prompt parts; provider SDKs don't send it,
// so it is dropped before comparing what the provider actually receives.
function wirePrompt(prompt: any[]) {
  return JSON.parse(JSON.stringify(prompt), (key, value) => (key === 'mastra' ? undefined : value));
}

// The next request only appends to the previous one, so the provider prompt cache is reused.
function expectAppendOnly(previous: any[], next: any[]) {
  expect(wirePrompt(next).slice(0, previous.length)).toEqual(wirePrompt(previous));
}

function toolResultIds(prompt: any[]) {
  return prompt
    .filter(msg => msg.role === 'tool')
    .flatMap(msg => msg.content)
    .map((part: any) => part.toolCallId);
}

describe('CyberRefusalHandler recovery mid-loop', () => {
  it('resumes the loop with prior tool work intact, and recovers again from a later refusal', async () => {
    const { model, prompts } = createScriptedModel([
      { tool: 'a.ts' },
      { tool: 'b.ts' },
      { refuse: true },
      { tool: 'c.ts' },
      { refuse: true },
      { text: 'All done.' },
    ]);

    const result = await createAgent(model).stream('Fix the failing test', { maxSteps: 10 });
    const chunks: any[] = [];
    for await (const chunk of result.fullStream) chunks.push(chunk);

    expect(await result.text).toBe('All done.');
    expect(prompts).toHaveLength(6);

    // Recovered refusals reach the client only as retry signals, never as error chunks.
    expect(chunks.filter(chunk => chunk.type === 'error')).toEqual([]);
    expect(chunks.filter(chunk => chunk.type === 'data-signal').map(chunk => chunk.data.contents)).toEqual([
      'continue',
      'continue',
    ]);

    // The refused call and its retry see the same prior tool work; the retry adds the nudge.
    expect(toolResultIds(prompts[2])).toEqual(['a.ts', 'b.ts']);
    expect(toolResultIds(prompts[3])).toEqual(['a.ts', 'b.ts']);
    expect(countReminders(prompts[2])).toBe(0);
    expect(countReminders(prompts[3])).toBe(1);

    // A successful step resets the retry count, so a later refusal in the same run is retried too.
    expect(toolResultIds(prompts[5])).toEqual(['a.ts', 'b.ts', 'c.ts']);
    expect(countReminders(prompts[5])).toBe(2);
  });

  it('treats a repeated refusal on the same step as genuine and surfaces the error', async () => {
    const { model, prompts } = createScriptedModel([{ tool: 'a.ts' }, { refuse: true }, { refuse: true }]);

    const result = await createAgent(model).stream('Fix the failing test', { maxSteps: 10 });
    const chunks: any[] = [];
    for await (const chunk of result.fullStream) chunks.push(chunk);

    expect(prompts).toHaveLength(3);
    const errorChunks = chunks.filter(chunk => chunk.type === 'error');
    expect(errorChunks).toHaveLength(1);
    expect(errorChunks[0].payload.error.message).toContain('flagged for possible cybersecurity risk');
  });

  it('rolls back an Anthropic cyber stop, keeps prior tool work, and recovers again later in the run', async () => {
    const partialText = 'Next I will trace the exploit path';
    const { model, prompts } = createScriptedModel([
      { tool: 'a.ts' },
      { cyberStop: true, partialText },
      { tool: 'b.ts' },
      { cyberStop: true },
      { text: 'All done.' },
    ]);

    const result = await createAgent(model).stream('Fix the failing test', { maxSteps: 10 });
    const chunks: any[] = [];
    for await (const chunk of result.fullStream) chunks.push(chunk);

    expect(await result.text).toBe('All done.');
    expect(prompts).toHaveLength(5);

    // The retry drops the refused partial output, keeps the tool work before it,
    // and appends the same continue nudge as the OpenAI path.
    const retryPrompt = JSON.stringify(prompts[2]);
    expect(retryPrompt).not.toContain(partialText);
    expect(toolResultIds(prompts[2])).toEqual(['a.ts']);

    // The nudge is appended after the conversation, so the retry extends the refused
    // request's prompt instead of rewriting its prefix (keeps the provider prompt cache).
    expectAppendOnly(prompts[1], prompts[2]);
    expect(prompts[2].filter((msg: any) => msg.role === 'system')).toEqual([
      { role: 'system', content: 'You are a coding agent' },
    ]);
    expect(countReminders(prompts[2])).toBe(1);
    expect(prompts[2].at(-1)).toEqual({
      role: 'user',
      content: [expect.objectContaining({ type: 'text', text: RETRY_REMINDER })],
    });
    expectAppendOnly(prompts[2], prompts[3]);
    expectAppendOnly(prompts[3], prompts[4]);

    // A successful step resets the retry count, so a later stop in the same run is
    // retried too — and its rollback keeps every accepted tool step.
    expect(toolResultIds(prompts[4])).toEqual(['a.ts', 'b.ts']);

    expect(chunks.filter(chunk => chunk.type === 'error')).toEqual([]);
  });

  it('stops on a repeated Anthropic cyber stop for the same step', async () => {
    const { model, prompts } = createScriptedModel([{ tool: 'a.ts' }, { cyberStop: true }, { cyberStop: true }]);

    const result = await createAgent(model).stream('Fix the failing test', { maxSteps: 10 });
    const chunks: any[] = [];
    for await (const chunk of result.fullStream) chunks.push(chunk);

    expect(prompts).toHaveLength(3);
    expect(await result.finishReason).toBe('content-filter');
  });
});
