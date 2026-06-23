import { describe, expect, it, vi } from 'vitest';
import { deserializePlatformSession, serializePlatformSession } from './platform-session';
import type { PlatformSessionCodec } from './platform-session';

const session = {
  baseUrl: 'https://platform.mastra.ai',
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  organizationId: 'org_1',
};

describe('Platform session persistence', () => {
  it('serializes plain sessions when encryption is unavailable', () => {
    const stored = serializePlatformSession(session);
    expect(stored.encoding).toBe('plain');
    expect(deserializePlatformSession(stored)).toEqual(session);
  });

  it('uses safeStorage-compatible encryption when available', () => {
    const codec: PlatformSessionCodec = {
      isEncryptionAvailable: () => true,
      encryptString: vi.fn(value => Buffer.from(`encrypted:${value}`)),
      decryptString: vi.fn(value => value.toString().replace(/^encrypted:/, '')),
    };

    const stored = serializePlatformSession(session, codec);
    expect(stored.encoding).toBe('safe-storage');
    expect(deserializePlatformSession(stored, codec)).toEqual(session);
  });
});
