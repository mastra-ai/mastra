import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import annotationRequest from './fixtures/om-relative-age-request.json';
import { transformRequest } from './transform-request';

const googleUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro-latest:streamGenerateContent';

describe('transformRequest', () => {
  it.each([
    ['Oct 25 2026:', 'Nov 2 2028:'],
    ['Date: Oct 25, 2026', 'Date: Nov 2, 2028'],
    ['Date: Oct 25, 2026 (yesterday)', 'Date: Nov 2, 2028 (3 years ago)'],
  ])('keeps replay hashes stable when the OM heading changes from %s to %s', (first, later) => {
    const hash = (heading: string) => {
      const request = {
        url: 'https://api.openai.com/v1/responses',
        body: { model: 'gpt-5-mini', input: [{ role: 'user', content: `${heading}\nUser: Lisbon weather?` }] },
      };
      const original = JSON.stringify(request);
      const normalized = transformRequest(request);
      expect(JSON.stringify(request)).toBe(original);
      return createHash('md5')
        .update(`${normalized.url}:${JSON.stringify(normalized.body)}`)
        .digest('hex');
    };
    expect(hash(first)).toBe(hash(later));
    expect(hash(`Previous observations:\n${first}`)).toBe(hash(`Previous observations:\n${later}`));
  });

  it.each(['Oct 25 2026:', 'Date: Oct 25, 2026'])('preserves ordinary user text containing %s', date => {
    const body = { messages: [{ role: 'user', content: `My note says ${date}\nPlease keep that date.` }] };
    expect(transformRequest({ url: 'https://api.anthropic.com/v1/messages', body }).body).toEqual(body);
  });

  it.each(['responses', 'chat', 'parts', 'anthropic'])(
    'normalizes only generated ages in %s observation blocks',
    shape => {
      const render = (age: string) => {
        const request = structuredClone(annotationRequest);
        request.body.input[2]!.content = request.body.input[2]!.content.replace(' - today)', ` - ${age})`);
        if (shape === 'responses') return request;
        const observations = `<observations>\n${request.body.input[2]!.content}\n</observations>`;
        const user = request.body.input[4]!;
        if (shape === 'anthropic') {
          return {
            url: 'https://api.anthropic.com/v1/messages',
            body: { system: [{ type: 'text', text: observations }], messages: [user] },
          };
        }
        if (shape === 'parts') {
          return {
            url: request.url,
            body: { input: [{ role: 'developer', content: [{ type: 'input_text', text: observations }] }, user] },
          };
        }
        return { url: request.url, body: { messages: [{ role: 'system', content: observations }, user] } };
      };
      const current = render('today');
      const original = JSON.stringify(current);
      const normalized = transformRequest(current);
      expect(normalized).toEqual(transformRequest(render('4 years ago')));
      expect(JSON.stringify(normalized.body)).toContain('(meaning Oct 26, 2026 - REDACTED_AGE)');
      expect(JSON.stringify(normalized.body)).toContain(annotationRequest.body.input[4]!.content);
      if (shape === 'responses') {
        expect(JSON.stringify(normalized.body)).toContain(annotationRequest.body.input[0]!.content);
        expect(JSON.stringify(normalized.body)).toContain('Keep this task (meaning Oct 26, 2026 - today).');
      }
      expect(JSON.stringify(current)).toBe(original);
    },
  );

  it('does not treat user-written observation tags as OM context', () => {
    const body = {
      input: [{ role: 'user', content: '<observations>\nMy note (meaning Oct 26, 2026 - today)\n</observations>' }],
    };
    expect(transformRequest({ url: annotationRequest.url, body }).body).toEqual(body);
  });

  it('ends an open OM block at the next non-system message', () => {
    const body = {
      input: [
        { role: 'developer', content: '<observations>' },
        { role: 'user', content: 'My note (meaning Oct 26, 2026 - today)' },
        { role: 'developer', content: 'Another instruction (meaning Oct 26, 2026 - today)' },
      ],
    };
    expect(transformRequest({ url: annotationRequest.url, body }).body).toEqual(body);
  });

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
