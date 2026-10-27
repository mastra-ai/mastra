import { expect, it } from 'vitest';
import { z } from 'zod/v4';
import { createTool } from '../../../../tools';
import { describeForAllEngines, runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';
import { geminiChunk, geminiFinal, useScriptedProviders } from '../scripted-sse';

/**
 * Ported from the AI SDK result-object suite (formerly test-utils/resultObject.ts),
 * which drove loop() with hand-built V2/V3 stream parts and checked the
 * resolved `result.*` promises. Here real v6 providers parse scripted wire
 * responses so the result fields are the ones a provider actually produces,
 * and each case runs on every engine.
 */

const openaiHello = [
  { type: 'response.created', response: { id: 'resp_1', created_at: 1, model: 'gpt-5' } },
  { type: 'response.output_item.added', output_index: 0, item: { type: 'message', id: 'msg_1' } },
  { type: 'response.output_text.delta', item_id: 'msg_1', delta: 'Hello' },
  { type: 'response.output_text.delta', item_id: 'msg_1', delta: ', world!' },
  { type: 'response.output_item.done', output_index: 0, item: { type: 'message', id: 'msg_1' } },
  {
    type: 'response.completed',
    response: { incomplete_details: null, usage: { input_tokens: 3, output_tokens: 10 }, service_tier: 'default' },
  },
];

function anthropicEvents(blocks: unknown[][]) {
  return [
    {
      type: 'message_start',
      message: { id: 'msg_a', model: 'claude-sonnet-4-5', usage: { input_tokens: 3, output_tokens: 0 } },
    },
    ...blocks.flat(),
    { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 10 } },
    { type: 'message_stop' },
  ];
}

const thinking = (index: number, text: string, signature: string) => [
  { type: 'content_block_start', index, content_block: { type: 'thinking', thinking: '' } },
  { type: 'content_block_delta', index, delta: { type: 'thinking_delta', thinking: text } },
  { type: 'content_block_delta', index, delta: { type: 'signature_delta', signature } },
  { type: 'content_block_stop', index },
];

const withoutCreatedAt = (parts: any[]) =>
  parts.map(({ providerOptions, ...part }) => {
    const { mastra: _mastra, ...rest } = providerOptions ?? {};
    return Object.keys(rest).length ? { ...part, providerOptions: rest } : part;
  });

const signedReasoning = [
  { type: 'reasoning', text: 'I will open with banter.', providerOptions: { anthropic: { signature: 'sig-1' } } },
  { type: 'reasoning', text: '', providerOptions: { anthropic: { redactedData: 'redacted-data' } } },
  { type: 'reasoning', text: ' Then pry.', providerOptions: { anthropic: { signature: 'sig-2' } } },
];

describeForAllEngines('AIMock loop scenario: ported result object (v6 providers)', engine => {
  const p = useScriptedProviders();

  const run = (model: () => any, extra: Record<string, unknown> = {}) =>
    runLoopScenario({ engine, llm: p.llm, model, prompt: 'test-input', fixtures: () => {}, ...extra });

  it('resolves text, usage, finish reason, provider metadata, request and response', async () => {
    p.openai.responses.push(openaiHello);
    const { output } = await run(p.openaiModel);

    expect(await output.text).toBe('Hello, world!');
    expect(await output.finishReason).toBe('stop');
    expect(await output.usage).toMatchObject({ inputTokens: 3, outputTokens: 10, totalTokens: 13 });
    expect(await output.providerMetadata).toEqual({ openai: { responseId: 'resp_1', serviceTier: 'default' } });

    const request: any = await output.request;
    if (engine === 'durable' || engine === 'evented') {
      // Durable engines deliberately keep the provider request echo out of the
      // event stream and snapshots (see the step-start note in
      // agent/durable/workflows/steps/llm-execution.ts and #26462).
      expect(request).toEqual({});
    } else {
      expect(request.body).toMatchObject({
        model: 'gpt-5',
        input: expect.arrayContaining([{ role: 'user', content: [{ type: 'input_text', text: 'test-input' }] }]),
      });
    }

    const response: any = await output.response;
    expect(response).toMatchObject({
      id: 'resp_1',
      modelId: 'gpt-5',
      timestamp: new Date(1000),
      headers: expect.objectContaining({ 'content-type': 'text/event-stream' }),
      modelMetadata: { modelId: 'gpt-5', modelVersion: 'v3', modelProvider: 'openai.responses' },
    });
    expect(withoutCreatedAt(response.messages.flatMap((m: any) => m.content))).toEqual([
      { type: 'text', text: 'Hello, world!', providerOptions: { openai: { itemId: 'msg_1' } } },
    ]);
  });

  it('resolves provider warnings for unsupported settings', async () => {
    p.openai.responses.push(openaiHello);
    const { output } = await run(p.openaiModel, { modelSettings: { seed: 1 } });

    expect(await output.warnings).toEqual([{ type: 'unsupported', feature: 'seed' }]);
  });

  it('resolves signed and redacted reasoning blocks in reasoning, response messages and step content', async () => {
    p.anthropic.responses.push(
      anthropicEvents([
        thinking(0, 'I will open with banter.', 'sig-1'),
        [
          {
            type: 'content_block_start',
            index: 1,
            content_block: { type: 'redacted_thinking', data: 'redacted-data' },
          },
          { type: 'content_block_stop', index: 1 },
        ],
        thinking(2, ' Then pry.', 'sig-2'),
        [
          { type: 'content_block_start', index: 3, content_block: { type: 'text', text: '' } },
          { type: 'content_block_delta', index: 3, delta: { type: 'text_delta', text: 'Hi there!' } },
          { type: 'content_block_stop', index: 3 },
        ],
      ]),
    );
    const { output } = await run(p.anthropicModel);

    expect(await output.text).toBe('Hi there!');
    expect(await output.reasoningText).toBe('I will open with banter. Then pry.');
    expect(((await output.reasoning) as any[]).map(r => r.payload)).toEqual([
      { id: '0', text: 'I will open with banter.', providerMetadata: { anthropic: { signature: 'sig-1' } } },
      { id: '1', text: '', providerMetadata: { anthropic: { redactedData: 'redacted-data' } } },
      { id: '2', text: ' Then pry.', providerMetadata: { anthropic: { signature: 'sig-2' } } },
    ]);

    const expected = [...signedReasoning, { type: 'text', text: 'Hi there!' }];
    const response: any = await output.response;
    expect(withoutCreatedAt(response.messages.flatMap((m: any) => m.content))).toEqual(expected);
    const steps: any[] = await output.steps;
    expect(steps).toHaveLength(1);
    expect(withoutCreatedAt(steps[0].content)).toEqual(expected);
  });

  it('resolves sources and files on the result and on the step', async () => {
    p.gemini.responses.push([
      geminiChunk([{ inlineData: { mimeType: 'text/plain', data: 'SGVsbG8gV29ybGQ=' } }]),
      geminiFinal([{ text: 'Hello!' }], {
        groundingMetadata: { groundingChunks: [{ web: { uri: 'https://example.com', title: 'Example' } }] },
      }),
    ]);
    const { output } = await run(p.geminiModel);

    const source = { id: expect.any(String), sourceType: 'url', title: 'Example', url: 'https://example.com' };
    const file = { data: 'SGVsbG8gV29ybGQ=', base64: 'SGVsbG8gV29ybGQ=', mimeType: 'text/plain' };
    expect(((await output.sources) as any[]).map(s => s.payload)).toEqual([source]);
    expect(((await output.files) as any[]).map(f => f.payload)).toEqual([file]);
    expect(await output.providerMetadata).toMatchObject({
      google: { groundingMetadata: { groundingChunks: [{ web: { uri: 'https://example.com', title: 'Example' } }] } },
    });

    const steps: any[] = await output.steps;
    expect(steps).toHaveLength(1);
    expect(steps[0].sources.map((s: any) => s.payload)).toEqual([source]);
    expect(steps[0].files.map((f: any) => f.payload)).toEqual([file]);
    expect(withoutCreatedAt(steps[0].content)).toEqual([
      { type: 'file', file: { type: 'file', base64Data: 'SGVsbG8gV29ybGQ=', mediaType: 'text/plain' } },
      { type: 'text', text: 'Hello!' },
    ]);
  });
});

describeForAllEngines('AIMock loop scenario: ported result object (tool calls)', engine => {
  const getMock = useLoopScenarioAimock();

  it('resolves the step tool calls and executed tool results', async () => {
    const tool1 = createTool({
      id: 'tool1',
      description: 'echoes a value',
      inputSchema: z.object({ value: z.string() }),
      execute: async ({ value }) => `${value}-result`,
    });

    const { output } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'test-input',
      tools: { tool1 },
      maxSteps: 1,
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { toolCalls: [{ id: 'call-1', name: 'tool1', arguments: { value: 'value' } }] });
      },
    });

    const toolCalls = (await output.toolCalls) as any[];
    expect(toolCalls.map(c => [c.type, c.payload])).toEqual([
      ['tool-call', expect.objectContaining({ toolCallId: 'call-1', toolName: 'tool1', args: { value: 'value' } })],
    ]);
    const toolResults = (await output.toolResults) as any[];
    expect(toolResults.map(r => [r.type, r.payload])).toEqual([
      [
        'tool-result',
        expect.objectContaining({
          toolCallId: 'call-1',
          toolName: 'tool1',
          args: { value: 'value' },
          result: 'value-result',
        }),
      ],
    ]);
  });
});
