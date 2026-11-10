import { RequestContext } from '@mastra/core/request-context';
import { describe, expect, it, vi } from 'vitest';

import { getTranscriptOutputSchema } from '../providers/fireflies/tools/get-transcript.js';
import { createFirefliesTools } from '../providers/fireflies/tools.js';

function createFirefliesFetch(transcript: Record<string, unknown>) {
  return vi.fn<typeof fetch>().mockImplementation(async input => {
    const url = new URL(String(input));
    if (url.pathname === '/v2/connections/connection/context') {
      return Response.json({ connection_config: {}, metadata: null });
    }
    return Response.json({ data: { transcript: { id: 't1', title: 'Weekly sync', ...transcript } } });
  });
}

async function getTranscript(transcript: Record<string, unknown>) {
  const fetchMock = createFirefliesFetch(transcript);
  const tools = createFirefliesTools({
    connectionId: 'connection',
    client: { baseUrl: 'https://platform.example.test', accessToken: 'test-platform-token', fetch: fetchMock },
  });
  const result = await tools.fireflies_get_transcript!.execute!({ id: 't1' }, { requestContext: new RequestContext() });
  return getTranscriptOutputSchema.parse(result);
}

describe('fireflies_get_transcript', () => {
  it('accepts keyword lists and numeric speaker ids from the live API', async () => {
    const result = await getTranscript({
      summary: { keywords: ['roadmap', 'pricing'], overview: 'Overview' },
      speakers: [
        { id: 0, name: 'Ada' },
        { id: 1, name: 'Grace' },
      ],
    });

    expect(result.summary?.keywords).toBe('roadmap, pricing');
    expect(result.summary?.overview).toBe('Overview');
    expect(result.speakers).toEqual([
      { id: '0', name: 'Ada' },
      { id: '1', name: 'Grace' },
    ]);
  });

  it('keeps string keywords and string speaker ids unchanged', async () => {
    const result = await getTranscript({
      summary: { keywords: 'roadmap, pricing' },
      speakers: [{ id: 'speaker-1', name: 'Ada' }],
    });

    expect(result.summary?.keywords).toBe('roadmap, pricing');
    expect(result.speakers).toEqual([{ id: 'speaker-1', name: 'Ada' }]);
  });

  it('normalizes an empty keyword list and preserves null or missing values', async () => {
    const result = await getTranscript({
      summary: { keywords: [] },
      speakers: [{ id: null, name: 'Ada' }, { name: 'Grace' }],
    });

    expect(result.summary?.keywords).toBe('');
    expect(result.speakers).toEqual([{ id: null, name: 'Ada' }, { name: 'Grace' }]);

    const withNulls = await getTranscript({ summary: { keywords: null }, speakers: null });
    expect(withNulls.summary?.keywords).toBeNull();
    expect(withNulls.speakers).toBeUndefined();
  });

  it('still rejects speaker ids that are neither strings nor numbers', async () => {
    await expect(getTranscript({ speakers: [{ id: { value: 1 }, name: 'Ada' }] })).rejects.toThrow();
    await expect(getTranscript({ summary: { keywords: [1, 2] } })).rejects.toThrow();
  });
});
