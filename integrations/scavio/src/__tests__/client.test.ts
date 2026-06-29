import { Scavio } from 'scavio';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { getScavioClient } from '../client.js';

vi.mock('scavio', () => ({
  Scavio: vi.fn(() => ({})),
}));

describe('getScavioClient', () => {
  const originalEnv = process.env.SCAVIO_API_KEY;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.SCAVIO_API_KEY;
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.SCAVIO_API_KEY = originalEnv;
    } else {
      delete process.env.SCAVIO_API_KEY;
    }
  });

  it('should throw if no API key is provided and env var is not set', () => {
    expect(() => getScavioClient()).toThrow('Scavio API key is required');
  });

  it('should use the API key from config', () => {
    getScavioClient({ apiKey: 'test-key-123' });
    expect(Scavio).toHaveBeenCalledWith({ apiKey: 'test-key-123' });
  });

  it('should fall back to SCAVIO_API_KEY env var', () => {
    process.env.SCAVIO_API_KEY = 'env-key-456';
    getScavioClient();
    expect(Scavio).toHaveBeenCalledWith({ apiKey: 'env-key-456' });
  });

  it('should prefer config.apiKey over env var', () => {
    process.env.SCAVIO_API_KEY = 'env-key-456';
    getScavioClient({ apiKey: 'config-key-789' });
    expect(Scavio).toHaveBeenCalledWith({ apiKey: 'config-key-789' });
  });
});
