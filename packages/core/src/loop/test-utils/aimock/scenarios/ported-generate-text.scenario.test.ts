import { expect, it } from 'vitest';
import { z } from 'zod/v4';
import { createTool } from '../../../../tools';
import { createOpenAI as createOpenAIV5 } from '@ai-sdk/openai-v5';
import { createSharedAgent, describeForAllEngines } from '../aimock-scenario';
import { isDurableEngineVariant } from '../types';
import { geminiChunk, geminiFinal, useScriptedProviders } from '../scripted-sse';

/**
 * Ported from the AI SDK generateText suite (formerly test-utils/generateText.ts),
 * which called loop() with `methodType: 'generate'` and a mock model. Here
 * `agent.generate()` talks to real v6 providers over scripted wire responses.
 *
 * The plain agent calls the provider's non-streaming endpoint for generate()
 * (scripted as `generated` JSON), while durable and evented build generate()
 * on top of a stream (scripted as SSE). Each case scripts both so every engine
 * gets the response it asks for.
 */

const openaiJson = {
  id: 'resp_1',
  created_at: 1,
  model: 'gpt-5',
  incomplete_details: null,
  service_tier: 'default',
  output: [
    {
      type: 'message',
      id: 'msg_1',
      role: 'assistant',
      content: [{ type: 'output_text', text: 'Hello, world!', annotations: [] }],
    },
  ],
  usage: { input_tokens: 3, output_tokens: 10 },
};

const openaiEvents = [
  { type: 'response.created', response: { id: 'resp_1', created_at: 1, model: 'gpt-5' } },
  { type: 'response.output_item.added', output_index: 0, item: { type: 'message', id: 'msg_1' } },
  { type: 'response.output_text.delta', item_id: 'msg_1', delta: 'Hello, world!' },
  { type: 'response.output_item.done', output_index: 0, item: { type: 'message', id: 'msg_1' } },
  {
    type: 'response.completed',
    response: { incomplete_details: null, usage: { input_tokens: 3, output_tokens: 10 }, service_tier: 'default' },
  },
];

const thought = { text: 'Let me think.', thought: true };
const image = { inlineData: { mimeType: 'image/png', data: 'AQID' } };
const text = { text: 'Hello, world!' };
const call = { functionCall: { name: 'tool1', args: { value: 'value' } } };
const grounding = {
  groundingMetadata: { groundingChunks: [{ web: { uri: 'https://example.com', title: 'Example' } }] },
};

const withoutCreatedAt = (parts: any[]) =>
  parts.map(({ providerOptions, ...part }) => {
    const { mastra: _mastra, ...rest } = providerOptions ?? {};
    return Object.keys(rest).length ? { ...part, providerOptions: rest } : part;
  });

describeForAllEngines('AIMock loop scenario: ported generateText (real providers)', engine => {
  const p = useScriptedProviders();
  const streamsGenerate = isDurableEngineVariant(engine);

  // v5 and v6 providers go through separate doGenerate wrappers (llm/model/aisdk/v5|v6/model.ts).
  it.each([
    {
      version: 'v5',
      model: () => createOpenAIV5({ apiKey: 'aimock', baseURL: `${p.llm.url}/openai` }).responses('gpt-5'),
    },
    { version: 'v6', model: () => p.openaiModel() },
  ])('resolves the request, response metadata, headers and body ($version provider)', async ({ version, model }) => {
    p.openai.generated.push(openaiJson);
    p.openai.responses.push(openaiEvents);
    const { agent } = await createSharedAgent(p.llm, { engine, model: model() });

    const result: any = await agent.generate('test-input');

    expect(result.text).toBe('Hello, world!');
    expect(result.finishReason).toBe('stop');
    expect(result.usage).toMatchObject({ inputTokens: 3, outputTokens: 10, totalTokens: 13 });

    if (streamsGenerate) {
      // Durable engines keep the provider request echo out of their snapshots (#26462).
      expect(result.request).toEqual({});
    } else {
      expect(result.request.body).toMatchObject({
        model: 'gpt-5',
        input: expect.arrayContaining([{ role: 'user', content: [{ type: 'input_text', text: 'test-input' }] }]),
      });
    }

    for (const response of [result.response, result.steps[0].response]) {
      expect(response).toMatchObject({
        id: 'resp_1',
        modelId: 'gpt-5',
        modelMetadata: {
          modelId: 'gpt-5',
          modelVersion: version === 'v5' ? 'v2' : 'v3',
          modelProvider: 'openai.responses',
        },
        headers: {
          'content-type': streamsGenerate ? 'text/event-stream' : 'application/json',
          'x-request-id': expect.any(String),
        },
      });
      expect(new Date(response.timestamp).getTime()).toBe(1000);
      expect(withoutCreatedAt(response.messages.flatMap((m: any) => m.content))).toEqual([
        { type: 'text', text: 'Hello, world!', providerOptions: { openai: { itemId: 'msg_1' } } },
      ]);
      // Only a non-streaming call has a response body to report.
      if (streamsGenerate) expect(response.body).toBeUndefined();
      else expect(response.body).toEqual(openaiJson);
    }
  });

  it('resolves sources, files, reasoning and the tool call and result on the step', async () => {
    p.gemini.generated.push(geminiFinal([thought, image, text, call], grounding));
    p.gemini.responses.push([
      geminiChunk([thought]),
      geminiChunk([image]),
      geminiChunk([text]),
      geminiFinal([call], grounding),
    ]);
    const tool1 = createTool({
      id: 'tool1',
      description: 'echoes a value',
      inputSchema: z.object({ value: z.string() }),
      execute: async ({ value }) => `${value}-result`,
    });
    const { agent } = await createSharedAgent(p.llm, { engine, model: p.geminiModel, tools: { tool1 } });

    const result: any = await agent.generate('test-input', { maxSteps: 1 });

    const source = { id: expect.any(String), sourceType: 'url', title: 'Example', url: 'https://example.com' };
    const file = { data: 'AQID', base64: 'AQID', mimeType: 'image/png' };
    expect(result.sources.map((s: any) => s.payload)).toEqual([source]);
    expect(result.files.map((f: any) => f.payload)).toEqual([file]);
    expect(result.reasoningText).toBe('Let me think.');

    expect(result.steps).toHaveLength(1);
    const [step] = result.steps;
    expect(step.sources.map((s: any) => s.payload)).toEqual([source]);
    expect(step.files.map((f: any) => f.payload)).toEqual([file]);
    // Sources are reported on `step.sources`, not as step content parts.
    expect(withoutCreatedAt(step.content)).toEqual([
      { type: 'reasoning', text: 'Let me think.' },
      { type: 'file', file: { type: 'file', base64Data: 'AQID', mediaType: 'image/png' } },
      { type: 'text', text: 'Hello, world!' },
      { type: 'tool-call', toolCallId: expect.any(String), toolName: 'tool1', input: { value: 'value' } },
      {
        type: 'tool-result',
        toolCallId: expect.any(String),
        toolName: 'tool1',
        input: { value: 'value' },
        output: { type: 'text', value: 'value-result' },
      },
    ]);
  });
});
