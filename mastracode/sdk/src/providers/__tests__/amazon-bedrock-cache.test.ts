import { describe, expect, it } from 'vitest';
import { bedrockCacheMiddleware } from '../amazon-bedrock-gateway.js';

// The middleware marks cache breakpoints with `providerOptions.bedrock.cachePoint`
// so Bedrock bills the re-sent prefix at the cache-read rate. Bedrock reads this
// key (not Anthropic's `cacheControl`), which is why the general prompt-cache
// middleware never applied on the Bedrock path.
const CACHE_POINT = { cachePoint: { type: 'default' } };

async function transform(prompt: Array<{ role: string; content: unknown; providerOptions?: unknown }>) {
  const result = await bedrockCacheMiddleware.transformParams!({
    type: 'generate',
    params: { prompt } as never,
    model: {} as never,
  });
  return result.prompt as Array<{ role: string; providerOptions?: { bedrock?: unknown } }>;
}

describe('bedrockCacheMiddleware', () => {
  it('marks the last system message and the most recent message as cache points', async () => {
    const out = await transform([
      { role: 'system', content: 'you are helpful' },
      { role: 'user', content: 'first' },
      { role: 'assistant', content: 'ok' },
      { role: 'user', content: 'latest' },
    ]);

    expect(out[0]!.providerOptions?.bedrock).toEqual(CACHE_POINT); // system
    expect(out[3]!.providerOptions?.bedrock).toEqual(CACHE_POINT); // most recent
    expect(out[1]!.providerOptions?.bedrock).toBeUndefined(); // untouched middle
    expect(out[2]!.providerOptions?.bedrock).toBeUndefined();
  });

  it('marks only the last message when there is no system message', async () => {
    const out = await transform([
      { role: 'user', content: 'a' },
      { role: 'user', content: 'b' },
    ]);

    expect(out[0]!.providerOptions?.bedrock).toBeUndefined();
    expect(out[1]!.providerOptions?.bedrock).toEqual(CACHE_POINT);
  });

  it('preserves existing providerOptions when adding the cache point', async () => {
    const out = await transform([{ role: 'user', content: 'hi', providerOptions: { openai: { store: false } } }]);

    expect(out[0]!.providerOptions).toEqual({ openai: { store: false }, bedrock: CACHE_POINT });
  });
});
