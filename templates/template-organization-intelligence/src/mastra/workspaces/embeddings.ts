import type { EmbeddingFunction } from './source-index.js';

export function openAIEmbedder(apiKey: string, request: typeof fetch = fetch): EmbeddingFunction {
  return async text => {
    for (let attempt = 0; attempt < 3; attempt++) {
      const response = await request('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: { authorization: 'Bearer ' + apiKey, 'content-type': 'application/json' },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: text,
          encoding_format: 'float',
          dimensions: 1536,
        }),
        signal: AbortSignal.timeout(30_000),
        redirect: 'error',
      });
      if ((response.status === 429 || response.status >= 500) && attempt < 2) {
        await response.body?.cancel();
        continue;
      }
      if (!response.ok) {
        await response.body?.cancel();
        throw new Error('Embedding request failed. Check OpenAI credentials and provider availability.');
      }
      const body = (await response.json()) as { data?: Array<{ embedding?: number[] }> };
      const vector = body.data?.[0]?.embedding;
      if (!vector || vector.length !== 1536 || !vector.every(Number.isFinite))
        throw new Error('Embedding provider returned an invalid vector.');
      return vector;
    }
    throw new Error('Embedding provider is unavailable.');
  };
}
