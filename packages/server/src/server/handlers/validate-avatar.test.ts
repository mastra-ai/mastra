import { describe, expect, it } from 'vitest';

import { HTTPException } from '../http-exception';
import { validateMetadataAvatarUrl } from './validate-avatar';

// 8-byte PNG signature encoded as base64.
const TINY_PNG_BASE64 = 'iVBORw0KGgo=';

describe('validateMetadataAvatarUrl', () => {
  it('no-ops when metadata is undefined or has no avatarUrl', () => {
    expect(() => validateMetadataAvatarUrl(undefined)).not.toThrow();
    expect(() => validateMetadataAvatarUrl({})).not.toThrow();
    expect(() => validateMetadataAvatarUrl({ avatarUrl: null })).not.toThrow();
    expect(() => validateMetadataAvatarUrl({ avatarUrl: undefined })).not.toThrow();
  });

  it('rejects non-string avatarUrl values', () => {
    expect(() => validateMetadataAvatarUrl({ avatarUrl: 5 })).toThrow(HTTPException);
  });

  describe('data: URLs', () => {
    it('accepts a valid small base64 data URL', () => {
      expect(() => validateMetadataAvatarUrl({ avatarUrl: `data:image/png;base64,${TINY_PNG_BASE64}` })).not.toThrow();
    });

    it('rejects malformed data URLs', () => {
      expect(() => validateMetadataAvatarUrl({ avatarUrl: 'not-a-data-url' })).toThrow(HTTPException);
    });

    it('rejects data URLs with invalid base64 payloads', () => {
      expect(() => validateMetadataAvatarUrl({ avatarUrl: 'data:image/png;base64,not-b64!' })).toThrow(HTTPException);
    });

    it('rejects data URLs exceeding the 512 KB limit', () => {
      const big = 'A'.repeat(512 * 1024 * 2);
      expect(() => validateMetadataAvatarUrl({ avatarUrl: `data:image/png;base64,${big}` })).toThrow(HTTPException);
    });
  });

  describe('mastra-avatar: URLs', () => {
    it('accepts a valid mastra-avatar reference', () => {
      expect(() => validateMetadataAvatarUrl({ avatarUrl: 'mastra-avatar:agent-1' })).not.toThrow();
    });

    it('rejects mastra-avatar URLs with an empty id', () => {
      expect(() => validateMetadataAvatarUrl({ avatarUrl: 'mastra-avatar:' })).toThrow(HTTPException);
    });

    it('rejects mastra-avatar URLs containing path traversal', () => {
      expect(() => validateMetadataAvatarUrl({ avatarUrl: 'mastra-avatar:../evil' })).toThrow(HTTPException);
      expect(() => validateMetadataAvatarUrl({ avatarUrl: 'mastra-avatar:foo/bar' })).toThrow(HTTPException);
    });

    it('rejects mastra-avatar URLs that do not match the expected agent id', () => {
      expect(() => validateMetadataAvatarUrl({ avatarUrl: 'mastra-avatar:other' }, 'expected')).toThrow(HTTPException);
    });

    it('accepts mastra-avatar URLs matching the expected agent id', () => {
      expect(() => validateMetadataAvatarUrl({ avatarUrl: 'mastra-avatar:expected' }, 'expected')).not.toThrow();
    });
  });

  describe('absolute URLs', () => {
    it('accepts https URLs', () => {
      expect(() => validateMetadataAvatarUrl({ avatarUrl: 'https://cdn.example.com/a.png' })).not.toThrow();
    });

    it('accepts http URLs', () => {
      expect(() => validateMetadataAvatarUrl({ avatarUrl: 'http://cdn.example.com/a.png' })).not.toThrow();
    });

    it('rejects malformed http URLs', () => {
      expect(() => validateMetadataAvatarUrl({ avatarUrl: 'http://' })).toThrow(HTTPException);
    });
  });
});
