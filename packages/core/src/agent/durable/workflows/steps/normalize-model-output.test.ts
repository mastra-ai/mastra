import { describe, expect, it } from 'vitest';

import { normalizeModelOutput } from './normalize-model-output';

// Regression tests for #22618 — normalizeModelOutput used to rewrite remote
// `image-url` parts into V2 `media` parts, stuffing the URL into the
// Base64-only `data` field and dropping `providerOptions`.
describe('normalizeModelOutput', () => {
  it('passes remote image-url parts through untouched', () => {
    const part = {
      type: 'image-url',
      url: 'https://example.com/radar.png',
      providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } } },
    };

    const result = normalizeModelOutput({ type: 'content', value: [part] }) as { value: unknown[] };

    // Exact passthrough — no fabricated mediaType, providerOptions intact.
    expect(result.value[0]).toBe(part);
  });

  it('passes file-url parts through untouched', () => {
    const part = { type: 'file-url', url: 'https://example.com/report.pdf', providerOptions: { a: { b: 1 } } };

    const result = normalizeModelOutput({ type: 'content', value: [part] }) as { value: unknown[] };

    expect(result.value[0]).toBe(part);
  });

  it('converts data-URI image-url parts to media with the parsed mediaType', () => {
    const result = normalizeModelOutput({
      type: 'content',
      value: [{ type: 'image-url', url: 'data:image/png;base64,abc123', providerOptions: { p: { keep: true } } }],
    }) as { value: unknown[] };

    expect(result.value[0]).toEqual({
      type: 'media',
      data: 'data:image/png;base64,abc123',
      mediaType: 'image/png',
      providerOptions: { p: { keep: true } },
    });
  });

  it('prefers the author-supplied mediaType for data-URI image-url parts', () => {
    const result = normalizeModelOutput({
      type: 'content',
      value: [{ type: 'image-url', url: 'data:image/png;base64,abc123', mediaType: 'image/webp' }],
    }) as { value: unknown[] };

    expect(result.value[0]).toEqual({ type: 'media', data: 'data:image/png;base64,abc123', mediaType: 'image/webp' });
  });

  it('converts image-data parts to media and preserves providerOptions', () => {
    const result = normalizeModelOutput({
      type: 'content',
      value: [{ type: 'image-data', data: 'aGVsbG8=', providerOptions: { p: { keep: true } } }],
    }) as { value: unknown[] };

    expect(result.value[0]).toEqual({
      type: 'media',
      data: 'aGVsbG8=',
      mediaType: 'image/jpeg',
      providerOptions: { p: { keep: true } },
    });
  });

  it('converts file-data parts to media with an octet-stream default mediaType', () => {
    const result = normalizeModelOutput({
      type: 'content',
      value: [{ type: 'file-data', data: 'aGVsbG8=' }],
    }) as { value: unknown[] };

    expect(result.value[0]).toEqual({ type: 'media', data: 'aGVsbG8=', mediaType: 'application/octet-stream' });
  });

  it('returns non-content outputs unchanged', () => {
    const textOutput = { type: 'text', value: 'hello' };
    expect(normalizeModelOutput(textOutput)).toBe(textOutput);
    expect(normalizeModelOutput(undefined)).toBeUndefined();
    expect(normalizeModelOutput('raw')).toBe('raw');
  });
});
