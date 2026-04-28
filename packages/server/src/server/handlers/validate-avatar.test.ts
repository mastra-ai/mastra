import { describe, it, expect } from 'vitest';

import { HTTPException } from '../http-exception';
import { validateMetadataAvatarUrl } from './validate-avatar';

// 1×1 transparent PNG — valid and tiny
const TINY_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
const TINY_PNG_DATA_URL = `data:image/png;base64,${TINY_PNG_BASE64}`;

describe('validateMetadataAvatarUrl', () => {
  it('no-ops when metadata is undefined', () => {
    expect(() => validateMetadataAvatarUrl(undefined)).not.toThrow();
  });

  it('no-ops when metadata has no avatarUrl', () => {
    expect(() => validateMetadataAvatarUrl({ foo: 'bar' })).not.toThrow();
  });

  it('no-ops when avatarUrl is null', () => {
    expect(() => validateMetadataAvatarUrl({ avatarUrl: null })).not.toThrow();
  });

  it('accepts a small valid data URL', () => {
    expect(() => validateMetadataAvatarUrl({ avatarUrl: TINY_PNG_DATA_URL })).not.toThrow();
  });

  it('rejects non-string avatarUrl with 400', () => {
    expect(() => validateMetadataAvatarUrl({ avatarUrl: 123 })).toThrow(HTTPException);
    try {
      validateMetadataAvatarUrl({ avatarUrl: 123 });
    } catch (e) {
      expect((e as HTTPException).status).toBe(400);
    }
  });

  it('rejects a plain URL (not a data URL) with 400', () => {
    expect(() => validateMetadataAvatarUrl({ avatarUrl: 'https://example.com/avatar.png' })).toThrow(HTTPException);
    try {
      validateMetadataAvatarUrl({ avatarUrl: 'https://example.com/avatar.png' });
    } catch (e) {
      expect((e as HTTPException).status).toBe(400);
    }
  });

  it('rejects malformed data URL (no base64 payload) with 400', () => {
    expect(() => validateMetadataAvatarUrl({ avatarUrl: 'data:image/png;base64,' })).toThrow(HTTPException);
    try {
      validateMetadataAvatarUrl({ avatarUrl: 'data:image/png;base64,' });
    } catch (e) {
      expect((e as HTTPException).status).toBe(400);
    }
  });

  it('rejects an oversized avatar with 413', () => {
    // 600 KB of zero bytes, base64-encoded
    const big = Buffer.alloc(600 * 1024, 0).toString('base64');
    const bigDataUrl = `data:image/png;base64,${big}`;

    expect(() => validateMetadataAvatarUrl({ avatarUrl: bigDataUrl })).toThrow(HTTPException);
    try {
      validateMetadataAvatarUrl({ avatarUrl: bigDataUrl });
    } catch (e) {
      expect((e as HTTPException).status).toBe(413);
      expect((e as HTTPException).message).toMatch(/exceeds/);
    }
  });

  it('accepts an avatar exactly at the 512KB limit', () => {
    // Create exactly 512KB of data
    const exactLimit = Buffer.alloc(512 * 1024, 0).toString('base64');
    const dataUrl = `data:image/png;base64,${exactLimit}`;
    expect(() => validateMetadataAvatarUrl({ avatarUrl: dataUrl })).not.toThrow();
  });

  it('rejects an avatar 1 byte over the 512KB limit', () => {
    const overLimit = Buffer.alloc(512 * 1024 + 1, 0).toString('base64');
    const dataUrl = `data:image/png;base64,${overLimit}`;
    expect(() => validateMetadataAvatarUrl({ avatarUrl: dataUrl })).toThrow(HTTPException);
    try {
      validateMetadataAvatarUrl({ avatarUrl: dataUrl });
    } catch (e) {
      expect((e as HTTPException).status).toBe(413);
    }
  });
});
