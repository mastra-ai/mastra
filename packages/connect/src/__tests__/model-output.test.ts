import { describe, expect, it } from 'vitest';

import { createImageTool } from '../providers/openai/tools/create-image.js';
import { toImageGenerationModelOutput } from '../runtime/model-output.js';
import type { PlatformProxy } from '../runtime/platform-proxy.js';

describe('toImageGenerationModelOutput', () => {
  it('is attached to the generated OpenAI image tool', () => {
    const tool = createImageTool({} as PlatformProxy);
    expect(tool.toModelOutput).toBe(toImageGenerationModelOutput);
  });

  it('uses a URL instead of duplicate base64 data when both are present', () => {
    const output = toImageGenerationModelOutput({
      data: [
        {
          url: 'https://example.test/image.png',
          b64_json: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB',
          revised_prompt: 'A tiny pineapple',
        },
      ],
    });

    expect(output).toEqual({
      type: 'content',
      value: [
        { type: 'text', text: 'Revised prompt: A tiny pineapple' },
        { type: 'image-url', url: 'https://example.test/image.png' },
      ],
    });
  });

  it.each([
    ['iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB', 'image/png'],
    ['/9j/4AAQSkZJRgABAQAAAQABAAD', 'image/jpeg'],
    ['UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEAAUAmJaQAA3AA', 'image/webp'],
  ])('converts base64 image data into a %s model part', (data, mediaType) => {
    expect(toImageGenerationModelOutput({ data: [{ b64_json: data }] })).toEqual({
      type: 'content',
      value: [{ type: 'image-data', data, mediaType }],
    });
  });

  it('returns a compact fallback when the provider returns no image content', () => {
    expect(toImageGenerationModelOutput({ data: [] })).toEqual({
      type: 'text',
      value: 'Image generation completed.',
    });
  });
});
