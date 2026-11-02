import { describe, expect, it } from 'vitest';

import { transformRequest } from './transform-request';

const googleUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro-latest:streamGenerateContent';
const openaiResponsesUrl = 'https://api.openai.com/v1/responses';
const anthropicUrl = 'https://api.anthropic.com/v1/messages';
const outputText = { type: 'output_text', text: 'Keep me.' };
const normalize = (url: string, body: unknown) => transformRequest({ url, body }).body;
const googleTool = (parameters: Record<string, unknown>) => ({
  tools: [{ functionDeclarations: [{ name: 'weather', description: 'Get the weather', ...parameters }] }],
  toolConfig: { functionCallingConfig: { mode: 'AUTO' } },
});
const jsonToolOutputs = [
  {
    provider: 'OpenAI',
    url: openaiResponsesUrl,
    body: (output: string) => ({ input: [{ type: 'function_call_output', output }] }),
  },
  {
    provider: 'Anthropic',
    url: anthropicUrl,
    body: (output: string) => ({
      messages: [{ role: 'user', content: [{ type: 'tool_result', is_error: true, content: output }] }],
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

  it('matches Responses assistant text without changing the conversation or original request', () => {
    const input = [
      { role: 'user', content: 'Check the result.' },
      { role: 'assistant', content: 'The result is ready.' },
      { role: 'assistant', content: 'Please review it.' },
      { role: 'user', content: 'What changed?' },
    ];
    const current = { model: 'gpt-5-mini', reasoning: { effort: 'high' }, input };
    const previous = {
      ...current,
      input: [
        input[0],
        {
          ...input[1],
          content: [
            { type: 'output_text', text: 'The result is ' },
            { type: 'output_text', text: 'ready.' },
          ],
        },
        { ...input[2], content: [{ type: 'output_text', text: input[2].content }] },
        input[3],
      ],
    };
    const original = structuredClone(previous);
    expect(normalize(openaiResponsesUrl, previous)).toEqual(normalize(openaiResponsesUrl, current));
    expect(normalize(openaiResponsesUrl, previous)).toEqual(current);
    expect(previous).toEqual(original);

    for (const changed of [
      [{ ...input[1], content: 'Different.' }, input[2]],
      [{ ...input[1], role: 'user' }, input[2]],
      [input[2], input[1]],
    ]) {
      expect(normalize(openaiResponsesUrl, { input: changed })).not.toEqual(
        normalize(openaiResponsesUrl, { input: input.slice(1, 3) }),
      );
    }
  });

  it.each([
    ['user text', { role: 'user', content: [outputText] }],
    ['developer text', { role: 'developer', content: [outputText] }],
    ['annotations', { role: 'assistant', content: [{ ...outputText, annotations: [] }] }],
    ['log probabilities', { role: 'assistant', content: [{ ...outputText, logprobs: [] }] }],
    ['input text', { role: 'assistant', content: [{ ...outputText, type: 'input_text' }] }],
    [
      'mixed media',
      { role: 'assistant', content: [outputText, { type: 'image', image_url: 'https://example.com/image.png' }] },
    ],
    ['empty content', { role: 'assistant', content: [] }],
    ['non-message items', { type: 'custom', role: 'assistant', content: [outputText] }],
  ])('preserves Responses %s', (_description, message) => {
    const body = { input: [message] };
    expect(normalize(openaiResponsesUrl, body)).toEqual(body);
  });

  it.each([
    'https://example.com/v1/responses',
    'https://api.openai.com/v1/chat/completions',
    'https://example.com/https://api.openai.com/v1/responses',
  ])('does not normalize assistant output text at %s', url => {
    const body = { input: [{ role: 'assistant', content: [outputText] }] };
    expect(normalize(url, body)).toEqual(body);
  });

  describe.each(jsonToolOutputs)('$provider JSON tool results', ({ url, body }) => {
    it('matches object property order without mutating the original request', () => {
      const previous = body('{"weather":"sunny","city":"San Francisco","history":[{"high":72,"low":50},null,true]}');
      const current = body('{"city":"San Francisco","history":[{"low":50,"high":72},null,true],"weather":"sunny"}');
      const original = structuredClone(previous);
      expect(normalize(url, previous)).toEqual(normalize(url, current));
      expect(previous).toEqual(original);
    });

    it.each([
      'not JSON',
      '{invalid}',
      '"plain JSON text"',
      '{"same":1,"same":2}',
      '{"precise":9007199254740993}',
      '{"precise":0.1234567890123456789012345}',
      '{"zero":-0}',
    ])('preserves text that cannot be canonicalized losslessly: %s', output => {
      expect(normalize(url, body(output))).toEqual(body(output));
    });

    it('keeps changed values, array order, types and field presence distinct', () => {
      const original = normalize(url, body('{"weather":"sunny","temperatures":[72,50],"note":null}'));
      for (const output of [
        '{"weather":"rainy","temperatures":[72,50],"note":null}',
        '{"weather":"sunny","temperatures":[50,72],"note":null}',
        '{"weather":"sunny","temperatures":[72,50]}',
        '{"weather":"sunny","temperatures":["72",50],"note":null}',
      ]) {
        expect(normalize(url, body(output))).not.toEqual(original);
      }
    });

    it('does not parse tool-looking data sent to another host', () => {
      const request = body('{"z":1,"a":2}');
      expect(normalize('https://example.com/v1/responses', request)).toEqual(request);
    });
  });

  it('preserves JSON prompt text and unrelated tool-result content', () => {
    const output = '{"z":1,"a":2}';
    const requests = [
      { url: openaiResponsesUrl, body: { input: [{ role: 'user', content: output }] } },
      { url: openaiResponsesUrl, body: { input: [{ role: 'assistant', content: output }] } },
      { url: anthropicUrl, body: { messages: [{ role: 'assistant', content: [{ type: 'text', text: output }] }] } },
      {
        url: anthropicUrl,
        body: { messages: [{ role: 'assistant', content: [{ type: 'tool_result', content: output }] }] },
      },
      { url: 'https://api.openai.com/v1/chat/completions', body: jsonToolOutputs[0].body(output) },
    ];
    for (const { url, body } of requests) expect(normalize(url, body)).toEqual(body);
  });

  it('matches Google tool schema aliases while retaining every constraint and the original request', () => {
    const schema = {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: { city: { type: 'string', minLength: 1 }, forecast: { type: 'array', items: { type: 'number' } } },
      required: ['city'],
      additionalProperties: false,
    };
    const previous = googleTool({ parameters: schema });
    const current = googleTool({ parametersJsonSchema: schema });
    const original = structuredClone(previous);
    expect(normalize(googleUrl, previous)).toEqual(normalize(googleUrl, current));
    expect(normalize(googleUrl, previous)).toEqual(current);
    expect(previous).toEqual(original);
    expect(
      normalize(googleUrl, googleTool({ parametersJsonSchema: { ...schema, additionalProperties: true } })),
    ).not.toEqual(normalize(googleUrl, previous));
  });

  it('retains conflicting Google aliases and schema-like data outside Google tool declarations', () => {
    const body = {
      ...googleTool({ parameters: { type: 'string' }, parametersJsonSchema: { type: 'number' } }),
      context: { parameters: { type: 'boolean' } },
    };
    expect(normalize(googleUrl, body)).toEqual(body);
    const outsideGoogle = googleTool({ parameters: { type: 'string' } });
    expect(normalize('https://example.com/v1/messages', outsideGoogle)).toEqual(outsideGoogle);
  });
});
