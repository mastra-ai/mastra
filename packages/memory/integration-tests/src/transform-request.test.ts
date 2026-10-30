import { describe, expect, it } from 'vitest';

import { transformRequest } from './transform-request';

const googleUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro-latest:streamGenerateContent';
const openaiResponsesUrl = 'https://api.openai.com/v1/responses';
const anthropicUrl = 'https://api.anthropic.com/v1/messages';

const jsonToolOutputs = [
  {
    provider: 'OpenAI',
    url: openaiResponsesUrl,
    body: (output: string) => ({
      model: 'gpt-5-mini',
      input: [{ type: 'function_call_output', call_id: 'call-weather', output }],
      reasoning: { effort: 'high' },
    }),
  },
  {
    provider: 'Anthropic',
    url: anthropicUrl,
    body: (output: string) => ({
      messages: [
        {
          role: 'user',
          content: [{ type: 'tool_result', tool_use_id: 'call-weather', is_error: true, content: output }],
        },
      ],
      metadata: { user_id: 'weather-user' },
    }),
  },
] as const;

describe('transformRequest', () => {
  it('normalizes legacy and current Google tool-call histories identically', () => {
    const text = { text: 'I will check the weather.' };
    const functionCall = {
      functionCall: { id: 'call-1', name: 'get_weather', args: { city: 'New York City' } },
      thoughtSignature: 'dynamic-signature',
    };
    const functionResponse = {
      functionResponse: { id: 'call-1', name: 'get_weather', response: { temperature: 72 } },
    };
    const userMessage = { role: 'user', parts: [{ text: "What's the weather?" }] };

    const current = transformRequest({
      url: googleUrl,
      body: {
        contents: [
          userMessage,
          { role: 'model', parts: [text, functionCall] },
          { role: 'user', parts: [functionResponse] },
        ],
      },
    });
    const legacy = transformRequest({
      url: googleUrl,
      body: {
        contents: [
          userMessage,
          {
            role: 'model',
            parts: [
              {
                functionCall: { name: 'get_weather', args: { city: 'New York City' } },
                thoughtSignature: 'old-signature',
              },
            ],
          },
          {
            role: 'user',
            parts: [{ functionResponse: { name: 'get_weather', response: { temperature: 72 } } }],
          },
          { role: 'model', parts: [text] },
        ],
      },
    });

    expect(current).toEqual(legacy);
    expect(current.body).toEqual({
      contents: [
        userMessage,
        {
          role: 'model',
          parts: [
            text,
            {
              functionCall: { name: 'get_weather', args: { city: 'New York City' } },
              thoughtSignature: 'REDACTED',
            },
          ],
        },
        {
          role: 'user',
          parts: [{ functionResponse: { name: 'get_weather', response: { temperature: 72 } } }],
        },
      ],
    });
  });

  it('only applies Google normalization to the Google API hostname', () => {
    const body = {
      contents: [{ role: 'model', parts: [{ functionCall: { id: 'call-1', name: 'get_weather', args: {} } }] }],
    };

    expect(transformRequest({ url: `https://example.com/${googleUrl}`, body }).body).toEqual({
      contents: [{ role: 'model', parts: [{ functionCall: { id: 'REDACTED', name: 'get_weather', args: {} } }] }],
    });
  });

  it('matches Responses assistant text across provider versions without changing the conversation', () => {
    const previous = {
      model: 'gpt-5-mini',
      reasoning: { effort: 'high' },
      input: [
        { role: 'user', content: 'Check the result.' },
        {
          role: 'assistant',
          content: [
            { type: 'output_text', text: 'The result is ' },
            { type: 'output_text', text: 'ready.' },
          ],
        },
        { role: 'assistant', content: [{ type: 'output_text', text: 'Please review it.' }] },
        { role: 'user', content: 'What changed?' },
      ],
    };
    const current = {
      ...previous,
      input: [
        previous.input[0],
        { role: 'assistant', content: 'The result is ready.' },
        { role: 'assistant', content: 'Please review it.' },
        previous.input[3],
      ],
    };
    const original = structuredClone(previous);

    expect(transformRequest({ url: openaiResponsesUrl, body: previous })).toEqual(
      transformRequest({ url: openaiResponsesUrl, body: current }),
    );
    expect(transformRequest({ url: openaiResponsesUrl, body: previous }).body).toEqual(current);
    expect(previous).toEqual(original);
  });

  it.each([
    ['user text', { role: 'user', content: [{ type: 'output_text', text: 'Keep me.' }] }],
    ['developer text', { role: 'developer', content: [{ type: 'output_text', text: 'Keep me.' }] }],
    ['annotations', { role: 'assistant', content: [{ type: 'output_text', text: 'Keep me.', annotations: [] }] }],
    ['log probabilities', { role: 'assistant', content: [{ type: 'output_text', text: 'Keep me.', logprobs: [] }] }],
    ['input text', { role: 'assistant', content: [{ type: 'input_text', text: 'Keep me.' }] }],
    [
      'mixed media',
      {
        role: 'assistant',
        content: [
          { type: 'output_text', text: 'Keep me.' },
          { type: 'image', image_url: 'https://example.com/image.png' },
        ],
      },
    ],
    ['empty content', { role: 'assistant', content: [] }],
    ['non-message items', { type: 'custom', role: 'assistant', content: [{ type: 'output_text', text: 'Keep me.' }] }],
  ])('preserves Responses %s rather than hiding a different request', (_description, message) => {
    const body = { input: [message] };
    expect(transformRequest({ url: openaiResponsesUrl, body }).body).toEqual(body);
  });

  it.each([
    'https://example.com/v1/responses',
    'https://api.openai.com/v1/chat/completions',
    'https://example.com/https://api.openai.com/v1/responses',
  ])('does not normalize assistant output text at %s', url => {
    const body = { input: [{ role: 'assistant', content: [{ type: 'output_text', text: 'Keep me.' }] }] };
    expect(transformRequest({ url, body }).body).toEqual(body);
  });

  it('continues to distinguish changed Responses text, roles and message order', () => {
    const input = [
      { role: 'assistant', content: 'First.' },
      { role: 'assistant', content: 'Second.' },
    ];
    const normalize = (messages: typeof input) =>
      transformRequest({ url: openaiResponsesUrl, body: { input: messages } });
    const original = normalize(input);

    expect(normalize([{ ...input[0], content: 'Different.' }, input[1]])).not.toEqual(original);
    expect(normalize([{ ...input[0], role: 'user' }, input[1]])).not.toEqual(original);
    expect(normalize([...input].reverse())).not.toEqual(original);
  });

  it.each(jsonToolOutputs)(
    'matches $provider JSON tool results regardless of object property order',
    ({ url, body }) => {
      const previous = body('{"weather":"sunny","city":"San Francisco","history":[{"high":72,"low":50},null,true]}');
      const current = body('{"city":"San Francisco","history":[{"low":50,"high":72},null,true],"weather":"sunny"}');
      const original = structuredClone(previous);

      expect(transformRequest({ url, body: previous })).toEqual(transformRequest({ url, body: current }));
      expect(previous).toEqual(original);
    },
  );

  describe.each(jsonToolOutputs)('$provider JSON tool results', ({ url, body }) => {
    it.each([
      'not JSON',
      '{invalid}',
      '"plain JSON text"',
      '{"same":1,"same":2}',
      '{"precise":9007199254740993}',
      '{"precise":0.1234567890123456789012345}',
      '{"zero":-0}',
    ])('preserves text that cannot be canonicalized losslessly: %s', output => {
      const request = body(output);
      const transformed = transformRequest({ url, body: request });
      // Unrelated dynamic IDs may be redacted by the existing normalizer.
      expect(JSON.stringify(transformed.body)).toContain(JSON.stringify(output));
    });

    it('keeps changed values, array order and field presence distinct', () => {
      const normalize = (output: string) => transformRequest({ url, body: body(output) });
      const original = normalize('{"weather":"sunny","temperatures":[72,50],"note":null}');

      expect(normalize('{"weather":"rainy","temperatures":[72,50],"note":null}')).not.toEqual(original);
      expect(normalize('{"weather":"sunny","temperatures":[50,72],"note":null}')).not.toEqual(original);
      expect(normalize('{"weather":"sunny","temperatures":[72,50]}')).not.toEqual(original);
      expect(normalize('{"weather":"sunny","temperatures":["72",50],"note":null}')).not.toEqual(original);
    });

    it('does not parse tool-looking data sent to another host', () => {
      const output = '{"z":1,"a":2}';
      const request = body(output);
      const transformed = transformRequest({ url: 'https://example.com/v1/responses', body: request });
      expect(JSON.stringify(transformed.body)).toContain(JSON.stringify(output));
    });
  });

  it('does not canonicalize JSON prompt text or unrelated tool-result content', () => {
    const output = '{"z":1,"a":2}';
    const prompts = [
      { url: openaiResponsesUrl, body: { input: [{ role: 'user', content: output }] } },
      { url: openaiResponsesUrl, body: { input: [{ role: 'assistant', content: output }] } },
      { url: anthropicUrl, body: { messages: [{ role: 'assistant', content: [{ type: 'text', text: output }] }] } },
      {
        url: anthropicUrl,
        body: { messages: [{ role: 'assistant', content: [{ type: 'tool_result', content: output }] }] },
      },
      { url: 'https://api.openai.com/v1/chat/completions', body: jsonToolOutputs[0].body(output) },
    ];

    for (const request of prompts) {
      expect(JSON.stringify(transformRequest(request).body)).toContain(JSON.stringify(output));
    }
  });

  it('matches Google tool schema key aliases while retaining every schema constraint', () => {
    const schema = {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: { city: { type: 'string', minLength: 1 }, forecast: { type: 'array', items: { type: 'number' } } },
      required: ['city'],
      additionalProperties: false,
    };
    const declaration = { name: 'weather', description: 'Get the weather', parameters: schema };
    const previous = {
      tools: [{ functionDeclarations: [declaration] }],
      toolConfig: { functionCallingConfig: { mode: 'AUTO' } },
    };
    const current = {
      ...previous,
      tools: [
        { functionDeclarations: [{ name: 'weather', description: 'Get the weather', parametersJsonSchema: schema }] },
      ],
    };
    const original = structuredClone(previous);

    expect(transformRequest({ url: googleUrl, body: previous })).toEqual(
      transformRequest({ url: googleUrl, body: current }),
    );
    expect(transformRequest({ url: googleUrl, body: previous }).body).toEqual(current);
    expect(previous).toEqual(original);

    const different = {
      ...current,
      tools: [
        {
          functionDeclarations: [
            {
              ...current.tools[0].functionDeclarations[0],
              parametersJsonSchema: { ...schema, additionalProperties: true },
            },
          ],
        },
      ],
    };
    expect(transformRequest({ url: googleUrl, body: different })).not.toEqual(
      transformRequest({ url: googleUrl, body: previous }),
    );
  });

  it('retains conflicting Google schema aliases and schema-like data outside tool declarations', () => {
    const body = {
      tools: [
        {
          functionDeclarations: [
            { name: 'weather', parameters: { type: 'string' }, parametersJsonSchema: { type: 'number' } },
          ],
        },
      ],
      context: { parameters: { type: 'boolean' } },
    };
    expect(transformRequest({ url: googleUrl, body }).body).toEqual(body);
    const outsideGoogle = { tools: [{ functionDeclarations: [{ name: 'weather', parameters: { type: 'string' } }] }] };
    expect(transformRequest({ url: 'https://example.com/v1/messages', body: outsideGoogle }).body).toEqual(
      outsideGoogle,
    );
  });
});
