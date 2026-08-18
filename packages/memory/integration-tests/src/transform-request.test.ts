import { describe, expect, it } from 'vitest';

import { transformRequest } from './transform-request';

const googleUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro-latest:streamGenerateContent';

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
});
