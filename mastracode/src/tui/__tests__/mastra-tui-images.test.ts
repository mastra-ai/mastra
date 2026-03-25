import { describe, expect, it } from 'vitest';
import { consumePendingImages } from '../mastra-tui.js';

describe('consumePendingImages', () => {
  it('uses only the images referenced by editor placeholders', () => {
    const result = consumePendingImages('Please inspect [image] carefully', [
      { data: 'image-1', mimeType: 'image/png' },
      { data: 'image-2', mimeType: 'image/jpeg' },
    ]);

    expect(result).toEqual({
      content: 'Please inspect carefully',
      images: [{ data: 'image-1', mimeType: 'image/png' }],
    });
  });

  it('drops stale pending images when no placeholder remains in the editor text', () => {
    const result = consumePendingImages('Just text now', [{ data: 'image-1', mimeType: 'image/png' }]);

    expect(result).toEqual({
      content: 'Just text now',
      images: undefined,
    });
  });

  it('supports image-only submissions', () => {
    const result = consumePendingImages('[image] ', [{ data: 'image-1', mimeType: 'image/png' }]);

    expect(result).toEqual({
      content: '',
      images: [{ data: 'image-1', mimeType: 'image/png' }],
    });
  });
});
