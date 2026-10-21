import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.doUnmock('@mastra/core/storage');
  vi.resetModules();
});

describe('optional core preview generator', () => {
  it('preserves supplied fields and skips payload hydration without the generator', async () => {
    vi.doMock('@mastra/core/storage', () => ({ buildStoredPreview: undefined }));
    const compat = await import('./preview-compat');
    expect(compat.canGeneratePreviews).toBe(false);
    for (const preview of [null, '', ' \t ', ' custom ', 'x'.repeat(500)]) {
      expect(compat.storedPreview(preview, 'payload')).toBe(preview);
      expect(compat.readPreview(preview, '"payload"', true)).toBe(preview);
      expect(compat.needsPreview(preview)).toBe(false);
    }
  });

  it('generates blank previews, trims supplied text, and caps long custom previews', async () => {
    const compat = await import('./preview-compat');
    expect(compat.canGeneratePreviews).toBe(true);
    for (const preview of [undefined, null, '', ' \t\n\u00a0\ufeff ']) {
      expect(compat.needsPreview(preview)).toBe(preview == null);
      expect(compat.storedPreview(preview, { text: 'payload' })).toBe('payload');
      expect(compat.readPreview(preview, '{"text":"payload"}', true)).toBe(preview == null ? 'payload' : null);
      expect(compat.readPreview(preview, '"   "', true)).toBeNull();
    }
    expect(compat.readPreview('  custom  ', 'other')).toBe('custom');
    expect(compat.storedPreview('x'.repeat(500), 'other')).toBe(`${'x'.repeat(100)}…`);
    expect(compat.storedPreview('x'.repeat(5_000_000), 'other')).toBe(`${'x'.repeat(100)}…`);
    expect(compat.readPreview(null, 'false', true)).toBe('false');
    expect(compat.readPreview(null, '0', true)).toBe('0');
  });
});
