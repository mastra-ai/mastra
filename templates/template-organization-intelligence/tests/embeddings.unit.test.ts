import { describe, expect, it, vi } from 'vitest';

import { openAIEmbedder } from '../src/mastra/workspaces/embeddings.js';

const vector = Array.from({ length: 1536 }, () => 0.5);

describe('embedding retries', () => {
  it.each([new TypeError('network reset'), new DOMException('timed out', 'TimeoutError')])(
    'recovers from a rejected request: %s',
    async error => {
      const request = vi
        .fn<typeof fetch>()
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce(Response.json({ data: [{ embedding: vector }] }));
      await expect(openAIEmbedder('synthetic-key', request)('policy')).resolves.toEqual(vector);
      expect(request).toHaveBeenCalledTimes(2);
      expect(request.mock.calls[0]?.[1]?.signal).not.toBe(request.mock.calls[1]?.[1]?.signal);
    },
  );

  it('propagates the last transport failure after three attempts', async () => {
    const error = new TypeError('network unavailable');
    const request = vi.fn<typeof fetch>().mockRejectedValue(error);
    await expect(openAIEmbedder('synthetic-key', request)('policy')).rejects.toBe(error);
    expect(request).toHaveBeenCalledTimes(3);
  });

  it('retries transient HTTP responses without retrying permanent errors', async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('', { status: 429 }))
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(Response.json({ data: [{ embedding: vector }] }));
    await expect(openAIEmbedder('synthetic-key', request)('policy')).resolves.toEqual(vector);
    expect(request).toHaveBeenCalledTimes(3);
    const unauthorized = vi.fn<typeof fetch>().mockResolvedValue(new Response('', { status: 401 }));
    await expect(openAIEmbedder('synthetic-key', unauthorized)('policy')).rejects.toThrow('credentials');
    expect(unauthorized).toHaveBeenCalledTimes(1);
  });
});
