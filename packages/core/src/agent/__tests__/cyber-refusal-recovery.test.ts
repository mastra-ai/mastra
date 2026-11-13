import { APICallError } from '@internal/ai-sdk-v5';
import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { afterEach, describe, expect, it, vi } from 'vitest';
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

type Turn =
  | { fail: true }
  | { refuse: true }
  | { cyberStop: true; partialText?: string }
  | { tool: string }
  | { text: string };

function createScriptedModel(turns: Turn[], identity: { provider?: string; modelId?: string } = {}) {
  const prompts: any[] = [];

  const model = new MockLanguageModelV2({
    ...identity,
    doStream: async ({ prompt }) => {
      prompts.push(prompt);
      const turn = turns[prompts.length - 1];
      if (!turn) throw new Error(`Unexpected model call #${prompts.length}`);
      if ('refuse' in turn) throw createRefusal();
      if ('fail' in turn) throw new Error('upstream failure');

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
    // Opt out of the shared stability defaults so this measures CyberRefusalHandler's own
    // behavior: the default StreamErrorRetryProcessor also retries the retryable refusal, which
    // would add calls on top of the handler's single nudge.
    outputProcessors: [new CyberRefusalHandler()],
    errorProcessors: [new CyberRefusalHandler()],
    errorProcessorDefaults: false,
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

describe('CyberRefusalHandler fallback models', () => {
  function createFallbackAgent(
    model: MockLanguageModelV2,
    fallbackModels: ConstructorParameters<typeof CyberRefusalHandler>[0]['fallbackModels'],
  ) {
    const handler = new CyberRefusalHandler({ fallbackModels });
    return new Agent({
      id: 'cyber-refusal-fallback-agent',
      name: 'Cyber Refusal Fallback Agent',
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
      inputProcessors: [handler],
      outputProcessors: [handler],
      errorProcessors: [handler],
      errorProcessorDefaults: false,
      maxProcessorRetries: 5,
    });
  }

  async function run(agent: Agent, prompt = 'Fix the failing test') {
    const result = await agent.stream(prompt, { maxSteps: 10 });
    const chunks: any[] = [];
    for await (const chunk of result.fullStream) chunks.push(chunk);
    return { result, chunks };
  }

  it('switches to the fallback when an Anthropic cyber stop survives the nudge', async () => {
    const primary = createScriptedModel([{ tool: 'a.ts' }, { cyberStop: true }, { cyberStop: true }]);
    const fallback = createScriptedModel([{ text: 'Done on the fallback.' }]);

    const { result } = await run(createFallbackAgent(primary.model, [fallback.model]));

    expect(await result.text).toBe('Done on the fallback.');
    expect(primary.prompts).toHaveLength(3);
    expect(fallback.prompts).toHaveLength(1);
    // The fallback picks up the run with the tool work done before the refusal.
    expect(toolResultIds(fallback.prompts[0])).toEqual(['a.ts']);
  });

  it('switches to the fallback when an OpenAI cyber_policy refusal survives the nudge', async () => {
    const primary = createScriptedModel([{ tool: 'a.ts' }, { refuse: true }, { refuse: true }]);
    const fallback = createScriptedModel([{ text: 'Done on the fallback.' }]);

    const { result, chunks } = await run(createFallbackAgent(primary.model, [fallback.model]));

    expect(await result.text).toBe('Done on the fallback.');
    expect(primary.prompts).toHaveLength(3);
    expect(fallback.prompts).toHaveLength(1);
    expect(toolResultIds(fallback.prompts[0])).toEqual(['a.ts']);
    expect(chunks.filter(chunk => chunk.type === 'error')).toEqual([]);
  });

  it('keeps the fallback for the rest of the run and starts the next run on the agent model', async () => {
    const primary = createScriptedModel([{ cyberStop: true }, { cyberStop: true }, { text: 'Primary again.' }]);
    const fallback = createScriptedModel([{ tool: 'b.ts' }, { text: 'Done on the fallback.' }]);
    const agent = createFallbackAgent(primary.model, [fallback.model]);

    const first = await run(agent);
    expect(await first.result.text).toBe('Done on the fallback.');
    expect(primary.prompts).toHaveLength(2);
    expect(fallback.prompts).toHaveLength(2);

    const second = await run(agent, 'Next task');
    expect(await second.result.text).toBe('Primary again.');
    expect(primary.prompts).toHaveLength(3);
    expect(fallback.prompts).toHaveLength(2);
  });

  it('asks a fallback function for each model in turn and stops when it returns none', async () => {
    const primary = createScriptedModel([{ cyberStop: true }, { cyberStop: true }]);
    const first = createScriptedModel([{ cyberStop: true }]);
    const second = createScriptedModel([{ cyberStop: true }]);
    const attempts: number[] = [];

    const { result } = await run(
      createFallbackAgent(primary.model, ({ attempt }) => {
        attempts.push(attempt);
        return [first.model, second.model][attempt];
      }),
    );

    expect(attempts).toEqual([0, 1, 2]);
    expect(primary.prompts).toHaveLength(2);
    expect(first.prompts).toHaveLength(1);
    expect(second.prompts).toHaveLength(1);
    expect(await result.finishReason).toBe('content-filter');
  });

  it("moves on to the agent's next model when the fallback itself fails", async () => {
    const primary = createScriptedModel([{ cyberStop: true }, { cyberStop: true }], { modelId: 'primary' });
    const broken = createScriptedModel([{ fail: true }], { modelId: 'broken-fallback' });
    const next = createScriptedModel([{ text: 'Done on the next agent model.' }], { modelId: 'next' });
    const handler = new CyberRefusalHandler({ fallbackModels: [broken.model] });
    const agent = new Agent({
      id: 'cyber-refusal-fallback-walk-agent',
      name: 'Cyber Refusal Fallback Walk Agent',
      instructions: 'You are a coding agent',
      model: [
        { model: primary.model, maxRetries: 0 },
        { model: next.model, maxRetries: 0 },
      ],
      inputProcessors: [handler],
      outputProcessors: [handler],
      errorProcessors: [handler],
      errorProcessorDefaults: false,
      maxProcessorRetries: 5,
    });

    const { result } = await run(agent);

    expect(primary.prompts).toHaveLength(2);
    expect(broken.prompts).toHaveLength(1);
    expect(next.prompts).toHaveLength(1);
    expect(await result.text).toBe('Done on the next agent model.');
  });

  it('ends the turn as before when no fallback is configured', async () => {
    const primary = createScriptedModel([{ cyberStop: true }, { cyberStop: true }]);

    const { result } = await run(createFallbackAgent(primary.model, undefined));

    expect(primary.prompts).toHaveLength(2);
    expect(await result.finishReason).toBe('content-filter');
  });
});

describe("CyberRefusalHandler 'auto' fallback", () => {
  // Anthropic Messages SSE for a plain completion, as the model router's Anthropic provider reads it.
  function anthropicCompletion(model: string, text: string): Response {
    const events: Array<[string, object]> = [
      [
        'message_start',
        {
          type: 'message_start',
          message: {
            id: 'msg_auto',
            type: 'message',
            role: 'assistant',
            model,
            content: [],
            stop_reason: null,
            stop_sequence: null,
            usage: { input_tokens: 1, output_tokens: 1 },
          },
        },
      ],
      ['content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } }],
      ['content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } }],
      ['content_block_stop', { type: 'content_block_stop', index: 0 }],
      [
        'message_delta',
        { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 1 } },
      ],
      ['message_stop', { type: 'message_stop' }],
    ];
    const body = events.map(([event, data]) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`).join('');
    return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } });
  }

  // Records what the router's Anthropic provider sends and answers as the requested model.
  function stubAnthropic() {
    const requests: Array<{ url: string; model: string }> = [];
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key');
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const { model } = JSON.parse(String(init?.body ?? '{}'));
      requests.push({ url, model });
      return anthropicCompletion(model, `Answered by ${model}.`);
    });
    return requests;
  }

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  function createAutoAgent(
    model: MockLanguageModelV2,
    fallbackModels?: ConstructorParameters<typeof CyberRefusalHandler>[0]['fallbackModels'],
  ) {
    const handler = new CyberRefusalHandler(fallbackModels === undefined ? undefined : { fallbackModels });
    return new Agent({
      id: 'cyber-refusal-auto-agent',
      name: 'Cyber Refusal Auto Agent',
      instructions: 'You are a coding agent',
      model: [{ model, maxRetries: 0 }],
      inputProcessors: [handler],
      outputProcessors: [handler],
      errorProcessors: [handler],
      errorProcessorDefaults: false,
      maxProcessorRetries: 5,
    });
  }

  async function run(agent: Agent) {
    const result = await agent.stream('Fix the failing test', { maxSteps: 5 });
    for await (const _chunk of result.fullStream) {
      // drain
    }
    return result;
  }

  const opus55 = { provider: 'anthropic.messages', modelId: 'claude-opus-5-5' };

  it.each([
    ['by default', undefined],
    ["with fallbackModels: 'auto'", 'auto' as const],
  ])('moves a refused mapped model to its provider fallback %s', async (_label, fallbackModels) => {
    const requests = stubAnthropic();
    const primary = createScriptedModel([{ cyberStop: true }, { cyberStop: true }], opus55);

    const result = await run(createAutoAgent(primary.model, fallbackModels));

    expect(primary.prompts).toHaveLength(2);
    expect(requests).toEqual([{ url: 'https://api.anthropic.com/v1/messages', model: 'claude-opus-4-8' }]);
    expect(await result.text).toBe('Answered by claude-opus-4-8.');
  });

  it('ends the turn as before for a model with no mapping', async () => {
    const requests = stubAnthropic();
    const primary = createScriptedModel([{ cyberStop: true }, { cyberStop: true }], {
      provider: 'anthropic.messages',
      modelId: 'claude-haiku-4-5',
    });

    const result = await run(createAutoAgent(primary.model));

    expect(primary.prompts).toHaveLength(2);
    expect(requests).toEqual([]);
    expect(await result.finishReason).toBe('content-filter');
  });

  it('uses explicit fallbackModels instead of the mapping', async () => {
    const requests = stubAnthropic();
    const primary = createScriptedModel([{ cyberStop: true }, { cyberStop: true }], opus55);
    const fallback = createScriptedModel([{ text: 'Done on the configured fallback.' }]);

    const result = await run(createAutoAgent(primary.model, [fallback.model]));

    expect(await result.text).toBe('Done on the configured fallback.');
    expect(fallback.prompts).toHaveLength(1);
    expect(requests).toEqual([]);
  });

  it('ends the turn as before when the handler is not registered as an input processor', async () => {
    const requests = stubAnthropic();
    const primary = createScriptedModel([{ cyberStop: true }, { cyberStop: true }], opus55);
    const handler = new CyberRefusalHandler();
    const agent = new Agent({
      id: 'cyber-refusal-output-only-agent',
      name: 'Cyber Refusal Output Only Agent',
      instructions: 'You are a coding agent',
      model: [{ model: primary.model, maxRetries: 0 }],
      outputProcessors: [handler],
      errorProcessors: [handler],
      errorProcessorDefaults: false,
      maxProcessorRetries: 5,
    });

    const result = await run(agent);

    expect(primary.prompts).toHaveLength(2);
    expect(requests).toEqual([]);
    expect(await result.finishReason).toBe('content-filter');
  });
});
