import { Readable } from 'node:stream';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DeepgramVoice } from './index.js';

const transcriptResponse = {
  metadata: {},
  results: { channels: [{ alternatives: [{ transcript: 'hello there', words: [] }] }] },
};

function captureListenRequests(): URL[] {
  const urls: URL[] = [];
  vi.stubGlobal('fetch', async (input: string | URL | Request) => {
    urls.push(new URL(input instanceof Request ? input.url : input));
    return Response.json(transcriptResponse);
  });
  return urls;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('DeepgramVoice.listen', () => {
  it.each([
    { name: 'no options', options: undefined, params: { model: 'nova-3' } },
    {
      name: 'an unset option beside a set one',
      options: { diarize: true, language: undefined },
      params: { model: 'nova-3', diarize: 'true' },
    },
  ])('asks Deepgram only for the options that are set ($name)', async ({ options, params }) => {
    const urls = captureListenRequests();
    const voice = new DeepgramVoice({ listeningModel: { name: 'nova-3', apiKey: 'dg-key' } });

    const result = await voice.listen(Readable.from(Buffer.from('audio')), options);

    expect(result.transcript).toBe('hello there');
    expect(urls.map(url => Object.fromEntries(url.searchParams))).toEqual([params]);
  });
});
