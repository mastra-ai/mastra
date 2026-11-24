import { Readable } from 'node:stream';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { DeepgramVoice } from './index.js';

let queries: Record<string, string>[] = [];

const server = setupServer(
  http.post('https://api.deepgram.com/v1/listen', ({ request }) => {
    queries.push(Object.fromEntries(new URL(request.url).searchParams));
    return HttpResponse.json({
      metadata: {},
      results: { channels: [{ alternatives: [{ transcript: 'hello there', words: [] }] }] },
    });
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  queries = [];
  server.resetHandlers();
});
afterAll(() => server.close());

describe('DeepgramVoice.listen', () => {
  it.each([
    { name: 'no options', options: undefined, params: { model: 'nova-3' } },
    {
      name: 'an unset option beside a set one',
      options: { diarize: true, language: undefined },
      params: { model: 'nova-3', diarize: 'true' },
    },
  ])('asks Deepgram only for the options that are set ($name)', async ({ options, params }) => {
    const voice = new DeepgramVoice({ listeningModel: { name: 'nova-3', apiKey: 'dg-key' } });

    const result = await voice.listen(Readable.from(Buffer.from('audio')), options);

    expect(result.transcript).toBe('hello there');
    expect(queries).toEqual([params]);
  });
});
