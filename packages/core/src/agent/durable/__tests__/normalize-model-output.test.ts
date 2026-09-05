import { describe, it, expect } from 'vitest';
import { normalizeModelOutput, downgradeImageUrlPartsForV2 } from '../workflows/steps/normalize-model-output';

describe('normalizeModelOutput', () => {
  it('keeps image-url parts as-is, preserving providerOptions', () => {
    const output = {
      type: 'content',
      value: [
        { type: 'text', text: 'radar image' },
        {
          type: 'image-url',
          url: 'https://example.com/radar.png',
          providerOptions: { repro: { traceId: 'preserve-me' } },
        },
      ],
    };

    expect(normalizeModelOutput(output)).toEqual(output);
  });

  it('still normalizes image-data parts into the media shape', () => {
    const output = {
      type: 'content',
      value: [{ type: 'image-data', data: 'abc123', mediaType: 'image/png' }],
    };

    expect(normalizeModelOutput(output)).toEqual({
      type: 'content',
      value: [{ type: 'media', data: 'abc123', mediaType: 'image/png' }],
    });
  });

  it('still normalizes file-data parts into the media shape', () => {
    const output = {
      type: 'content',
      value: [{ type: 'file-data', data: 'Zm9v' }],
    };

    expect(normalizeModelOutput(output)).toEqual({
      type: 'content',
      value: [{ type: 'media', data: 'Zm9v', mediaType: 'application/octet-stream' }],
    });
  });

  it('returns non-content outputs untouched', () => {
    expect(normalizeModelOutput({ foo: 'bar' })).toEqual({ foo: 'bar' });
    expect(normalizeModelOutput(null)).toBeNull();
    expect(normalizeModelOutput('text')).toBe('text');
  });
});

describe('downgradeImageUrlPartsForV2', () => {
  it('downgrades image-url parts to the V2 media shape', () => {
    const output = {
      type: 'content',
      value: [
        { type: 'text', text: 'radar image' },
        { type: 'image-url', url: 'https://example.com/radar.png', mediaType: 'image/png' },
      ],
    };

    expect(downgradeImageUrlPartsForV2(output)).toEqual({
      type: 'content',
      value: [
        { type: 'text', text: 'radar image' },
        { type: 'media', data: 'https://example.com/radar.png', mediaType: 'image/png' },
      ],
    });
  });

  it('defaults mediaType to image/jpeg and infers it from data: URLs', () => {
    const output = {
      type: 'content',
      value: [
        { type: 'image-url', url: 'https://example.com/a.png' },
        { type: 'image-url', url: 'data:image/webp;base64,abc' },
      ],
    };

    expect(downgradeImageUrlPartsForV2(output)).toEqual({
      type: 'content',
      value: [
        { type: 'media', data: 'https://example.com/a.png', mediaType: 'image/jpeg' },
        { type: 'media', data: 'data:image/webp;base64,abc', mediaType: 'image/webp' },
      ],
    });
  });

  it('leaves media parts and non-content outputs untouched', () => {
    const output = {
      type: 'content',
      value: [{ type: 'media', data: 'abc', mediaType: 'image/png' }],
    };
    expect(downgradeImageUrlPartsForV2(output)).toEqual(output);
    expect(downgradeImageUrlPartsForV2('raw')).toBe('raw');
  });
});
