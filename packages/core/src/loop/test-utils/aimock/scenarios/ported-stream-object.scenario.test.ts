import { createOpenAI } from '@ai-sdk/openai-v6';
import { jsonSchema, pipeTextStreamToResponse } from '@internal/ai-sdk-v5';
import { expect, it } from 'vitest';
import { z } from 'zod/v4';
import { createMockServerResponse } from '../../mock-server-response';
import { describeForAllEngines, isDurableEngineVariant, runLoopScenario } from '../aimock-scenario';
import type { RunLoopScenarioOptions } from '../aimock-scenario';
import { geminiChunk, geminiFinal, useScriptedProviders } from '../scripted-sse';

/**
 * Ported from the AI SDK streamObject suite (formerly test-utils/streamObject.ts),
 * which drove loop() with hand-built stream parts and a structured-output
 * schema. Here the real OpenAI v6 Responses provider parses scripted wire
 * responses and builds the request, so the JSON schema it sends and the text
 * deltas the loop parses are what a provider actually produces. Every case
 * runs on every engine.
 */

function responsesText(deltas: string[], response: Record<string, unknown> = {}) {
  return [
    { type: 'response.created', response: { id: 'resp_1', created_at: 0, model: 'gpt-5' } },
    { type: 'response.output_item.added', output_index: 0, item: { type: 'message', id: 'msg_1' } },
    ...deltas.map(delta => ({ type: 'response.output_text.delta', item_id: 'msg_1', delta })),
    { type: 'response.output_item.done', output_index: 0, item: { type: 'message', id: 'msg_1' } },
    {
      type: 'response.completed',
      response: { incomplete_details: null, usage: { input_tokens: 3, output_tokens: 10 }, ...response },
    },
  ];
}

const helloDeltas = ['{ ', '"content": ', '"Hello, ', 'world', '!"', ' }'];
const contentSchema = z.object({ content: z.string() });
const enumSchema = z.enum(['sunny', 'rainy', 'snowy']);
const enumDeltas = (value: string[]) => ['{ ', '"result": ', ...value, '"', ' }'];

async function collect<T>(stream: AsyncIterable<T> | ReadableStream<T>): Promise<T[]> {
  const items: T[] = [];
  for await (const item of stream as AsyncIterable<T>) items.push(item);
  return items;
}

describeForAllEngines('AIMock loop scenario: ported streamObject (real providers)', engine => {
  const p = useScriptedProviders();

  const run = (deltas: string[], schema: unknown, extra: Partial<RunLoopScenarioOptions> = {}) => {
    p.openai.responses.push(responsesText(deltas));
    return runLoopScenario({
      engine,
      llm: p.llm,
      model: () => p.openaiModel(),
      prompt: 'Answer with JSON.',
      fixtures: () => {},
      structuredOutput: { schema: schema as any },
      ...extra,
    });
  };

  it('resolves the object without consuming any stream', async () => {
    const { output } = await run(helloDeltas, contentSchema, { manualStreamConsumption: true });
    expect(await output.object).toStrictEqual({ content: 'Hello, world!' });
  });

  it('sends the JSON schema to the provider and streams object partials and raw text deltas', async () => {
    const onFinishEvents: any[] = [];
    const { output } = await run(helloDeltas, contentSchema, { onFinish: event => void onFinishEvents.push(event) });

    expect(await collect(output.objectStream)).toStrictEqual([
      {},
      { content: 'Hello, ' },
      { content: 'Hello, world' },
      { content: 'Hello, world!' },
    ]);
    expect(await collect(output.textStream)).toStrictEqual(helloDeltas);
    expect(await output.object).toStrictEqual({ content: 'Hello, world!' });
    expect(await output.finishReason).toBe('stop');
    expect(await output.usage).toMatchObject({ inputTokens: 3, outputTokens: 10, totalTokens: 13 });
    expect(await output.providerMetadata).toMatchObject({ openai: { responseId: 'resp_1' } });
    expect((await output.response).id).toBe('resp_1');
    expect(onFinishEvents).toHaveLength(1);
    expect(onFinishEvents[0]).toMatchObject({
      object: { content: 'Hello, world!' },
      text: '{ "content": "Hello, world!" }',
      finishReason: 'stop',
      usage: { inputTokens: 3, outputTokens: 10 },
      response: { id: 'resp_1', modelId: 'gpt-5' },
    });

    expect(p.openai.requests[0].text.format).toMatchObject({
      type: 'json_schema',
      strict: true,
      schema: {
        type: 'object',
        properties: { content: { type: 'string' } },
        required: ['content'],
        additionalProperties: false,
      },
    });
  });

  it('resolves the object after the object stream was consumed first', async () => {
    const { output } = await run(helloDeltas, contentSchema, { manualStreamConsumption: true });
    void collect(output.objectStream);
    expect(await output.object).toStrictEqual({ content: 'Hello, world!' });
  });

  it('sends model config headers merged with modelSettings headers, the runtime ones winning', async () => {
    const { output } = await run(['{ "content": "merged headers test" }'], contentSchema, {
      model: () => [
        {
          id: 'gpt-5',
          maxRetries: 0,
          model: p.openaiModel(),
          headers: { 'x-model-header': 'from-config', 'x-shared-header': 'from-config' },
        },
      ],
      modelSettings: { headers: { 'x-shared-header': 'from-runtime', 'x-runtime-header': 'from-runtime' } },
    });

    expect(await output.object).toStrictEqual({ content: 'merged headers test' });
    expect(p.openai.requestHeaders[0]).toMatchObject({
      'x-model-header': 'from-config',
      'x-shared-header': 'from-runtime',
      'x-runtime-header': 'from-runtime',
    });
  });

  it('passes provider options through to the provider request', async () => {
    const { output } = await run(helloDeltas, contentSchema, {
      providerOptions: { openai: { user: 'user-123', metadata: { source: 'stream-object' } } },
    });

    expect(await output.object).toStrictEqual({ content: 'Hello, world!' });
    expect(p.openai.requests[0]).toMatchObject({ user: 'user-123', metadata: { source: 'stream-object' } });
    expect(p.openai.requests[0].text.format.type).toBe('json_schema');
  });

  it('does not leave an unhandled rejection when only the object stream is read and the object does not match', async () => {
    const { output } = await run(['{ ', '"invalid": ', '"Hello, world!"', ' }'], contentSchema, {
      expectStreamError: true,
      onError: () => {},
    });
    // Reading only the object stream must not leak the rejected object promise;
    // vitest fails the run on an unhandled rejection.
    await collect(output.objectStream);
    await new Promise(resolve => setTimeout(resolve, 10));
  });

  it('pipes the text deltas to a Node.js response', async () => {
    const { output } = await run(helloDeltas, contentSchema);
    const response = createMockServerResponse();
    pipeTextStreamToResponse({ response, textStream: output.textStream as any });
    await response.waitForEnd();

    expect(response.statusCode).toBe(200);
    expect(response.headers).toStrictEqual({ 'content-type': 'text/plain; charset=utf-8' });
    expect(response.getDecodedChunks()).toStrictEqual(helloDeltas);
  });

  it('sends a raw JSON schema and parses the object against it', async () => {
    const schema = jsonSchema<{ content: string }>({
      type: 'object',
      properties: { content: { type: 'string' } },
      required: ['content'],
      additionalProperties: false,
    });
    const { output } = await run(helloDeltas, schema);

    expect(await collect(output.objectStream)).toContainEqual({ content: 'Hello, world!' });
    expect(await output.object).toStrictEqual({ content: 'Hello, world!' });
    expect(p.openai.requests[0].text.format.schema).toMatchObject({
      properties: { content: { type: 'string' } },
      required: ['content'],
    });
  });

  it('emits no partials and reports the error through onError when the model call fails', async () => {
    const errors: unknown[] = [];
    const { output } = await runLoopScenario({
      engine,
      llm: p.llm,
      // No endpoint is mounted here, so the provider call fails with a 404.
      model: () => createOpenAI({ apiKey: 'aimock', baseURL: `${p.llm.url}/missing` }).responses('gpt-5'),
      prompt: 'Answer with JSON.',
      fixtures: () => {},
      structuredOutput: { schema: contentSchema },
      maxRetries: 0,
      errorProcessors: [],
      modelSettings: { maxRetries: 0 },
      expectStreamError: true,
      onError: ({ error }) => void errors.push(error),
    });

    expect(await collect(output.objectStream)).toStrictEqual([]);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toBeInstanceOf(Error);
    expect((errors[0] as Error).message).toContain('No fixture matched');
  });

  it('rejects the object with the Zod error and reports the failure when the object does not match', async () => {
    const onFinishEvents: any[] = [];
    const onErrorEvents: unknown[] = [];
    // Gemini, not OpenAI: for OpenAI strict-mode models the plain agent wraps the schema
    // with a null-to-undefined transform, which drops the ZodError cause.
    p.gemini.responses.push([geminiChunk([{ text: '{ "content": ' }]), geminiFinal([{ text: '123 }' }])]);
    const { output } = await runLoopScenario({
      engine,
      llm: p.llm,
      model: () => p.geminiModel(),
      prompt: 'Answer with JSON.',
      fixtures: () => {},
      structuredOutput: { schema: contentSchema },
      expectStreamError: true,
      onFinish: (event: any) => void onFinishEvents.push(event),
      onError: ({ error }) => void onErrorEvents.push(error),
    });

    const message = 'Structured output validation failed: - content: Invalid input: expected string, received number';
    const error = await (output.object as Promise<unknown>).then(
      () => undefined,
      err => err as Error & { cause: z.ZodError },
    );
    expect(error?.message).toBe(message);
    expect(error?.cause).toBeInstanceOf(z.ZodError);
    expect(error?.cause.issues).toHaveLength(1);
    expect(error?.cause.issues[0]?.path).toEqual(['content']);
    expect(error?.cause.issues[0]?.message).toContain('expected string, received number');

    // Known difference: the plain agent reports the failure through onError and skips onFinish,
    // while durable/evented call onFinish with finishReason 'stop' and the error attached.
    if (isDurableEngineVariant(engine)) {
      expect(onErrorEvents).toHaveLength(0);
      expect(onFinishEvents).toHaveLength(1);
      expect(onFinishEvents[0]).toMatchObject({ finishReason: 'stop', object: undefined });
      expect(String(onFinishEvents[0].error?.message)).toBe(message);
    } else {
      expect(onFinishEvents).toHaveLength(0);
      expect(onErrorEvents).toHaveLength(1);
      expect((onErrorEvents[0] as Error).message).toBe(message);
    }
  });

  it('parses an object wrapped in a json code fence without newlines', async () => {
    const { output } = await run(['```json', '{ "content": "Hello, world!" }', '```'], contentSchema);
    expect(await output.object).toStrictEqual({ content: 'Hello, world!' });
  });

  it('streams an array schema element by element', async () => {
    const onFinishEvents: any[] = [];
    const deltas = [
      '{"elements":[',
      '{',
      '"content":',
      '"element 1"',
      '},',
      '{ ',
      '"content": ',
      '"element 2"',
      '},',
      '{',
      '"content":',
      '"element 3"',
      '}',
      ']',
      '}',
    ];
    const elements = [{ content: 'element 1' }, { content: 'element 2' }, { content: 'element 3' }];
    const { output } = await run(deltas, z.array(contentSchema), {
      onFinish: event => void onFinishEvents.push(event),
    });

    expect(await collect(output.objectStream)).toStrictEqual([
      [],
      elements.slice(0, 1),
      elements.slice(0, 2),
      elements,
    ]);
    expect(await collect(output.elementStream)).toStrictEqual(elements);
    // textStream carries the elements array, not the provider's { elements } wrapper.
    expect((await collect(output.textStream)).join('')).toBe(JSON.stringify(elements));
    expect(await output.object).toStrictEqual(elements);
    expect(onFinishEvents[0].object).toStrictEqual(elements);
    expect(p.openai.requests[0].text.format.schema).toMatchObject({
      properties: { elements: { type: 'array', items: { properties: { content: { type: 'string' } } } } },
      required: ['elements'],
    });
  });

  it('streams a single-chunk array as one partial and every element', async () => {
    const elements = [{ content: 'element 1' }, { content: 'element 2' }];
    const { output } = await run([JSON.stringify({ elements })], z.array(contentSchema));

    expect(await collect(output.objectStream)).toStrictEqual([elements]);
    expect(await collect(output.elementStream)).toStrictEqual(elements);
    expect(await output.object).toStrictEqual(elements);
  });

  it('rejects an array object whose elements do not match the schema', async () => {
    const { output } = await run(['{"elements":[{"x":1},{"x":2},{"x":3}]}'], z.array(contentSchema), {
      expectStreamError: true,
    });
    await expect(output.object).rejects.toThrow(
      'Structured output validation failed: - 0.content: Invalid input: expected string, received undefined\n' +
        '- 1.content: Invalid input: expected string, received undefined\n' +
        '- 2.content: Invalid input: expected string, received undefined',
    );
  });

  it('streams an enum value and sends it as a wrapped enum schema', async () => {
    const { output } = await run(enumDeltas(['"su', 'nny']), enumSchema);

    expect(await collect(output.objectStream)).toStrictEqual(['sunny']);
    expect(await output.object).toBe('sunny');
    expect(p.openai.requests[0].text.format.schema).toMatchObject({
      properties: { result: { type: 'string', enum: ['sunny', 'rainy', 'snowy'] } },
      required: ['result'],
    });
  });

  it('streams an enum wrapped in a json code fence', async () => {
    const { output } = await run(['```json\n', ...enumDeltas(['"su', 'nny']), '\n```'], enumSchema);
    expect(await collect(output.objectStream)).toStrictEqual(['sunny']);
    expect(await output.object).toBe('sunny');
  });

  it('streams a partial enum behind a json code fence prefix', async () => {
    const { output } = await run(['```json\n', ...enumDeltas(['"su', 'nny'])], enumSchema);
    expect(await collect(output.objectStream)).toStrictEqual(['sunny']);
  });

  it('does not stream enum values outside the schema', async () => {
    const { output } = await run(enumDeltas(['"foo', 'bar']), enumSchema, { expectStreamError: true });
    expect(await collect(output.objectStream)).toStrictEqual([]);
  });

  it('streams an ambiguous enum prefix, then the full value', async () => {
    const { output } = await run(enumDeltas(['"foo', 'bar']), z.enum(['foobar', 'foobar2']));
    expect(await collect(output.objectStream)).toStrictEqual(['foo', 'foobar']);
  });

  it('streams only the full value for a non-ambiguous enum', async () => {
    const { output } = await run(enumDeltas(['"foo', 'bar']), z.enum(['foobar', 'barfoo']));
    expect(await collect(output.objectStream)).toStrictEqual(['foobar']);
  });
});
