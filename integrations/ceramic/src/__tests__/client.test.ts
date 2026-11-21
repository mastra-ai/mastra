import Ceramic from 'ceramic-ai';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockSearch } = vi.hoisted(() => ({
  mockSearch: vi.fn(),
}));

vi.mock('ceramic-ai', () => ({
  default: vi.fn(function CeramicClient() {
    return { search: mockSearch };
  }),
}));

import { createLazyCeramicClient, getCeramicClient } from '../client.js';

describe('getCeramicClient', () => {
  const originalApiKey = process.env.CERAMIC_API_KEY;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.CERAMIC_API_KEY;
  });

  afterEach(() => {
    if (originalApiKey === undefined) {
      delete process.env.CERAMIC_API_KEY;
    } else {
      process.env.CERAMIC_API_KEY = originalApiKey;
    }
  });

  it('throws a clear error when no API key is available', () => {
    expect(() => getCeramicClient()).toThrow(
      'Ceramic API key is required. Pass { apiKey } or set the CERAMIC_API_KEY environment variable.',
    );
    expect(Ceramic).not.toHaveBeenCalled();
  });

  it('passes explicit client options to the official SDK', () => {
    getCeramicClient({ apiKey: 'ceramic-explicit', baseURL: 'https://ceramic.example.test', maxRetries: 0 });

    expect(Ceramic).toHaveBeenCalledWith({
      apiKey: 'ceramic-explicit',
      baseURL: 'https://ceramic.example.test',
      maxRetries: 0,
      fetch: expect.any(Function),
    });
  });

  it('falls back to CERAMIC_API_KEY', () => {
    process.env.CERAMIC_API_KEY = 'ceramic-env';

    getCeramicClient();

    expect(Ceramic).toHaveBeenCalledWith({ apiKey: 'ceramic-env', fetch: expect.any(Function) });
  });

  it('prefers an explicit API key over the environment', () => {
    process.env.CERAMIC_API_KEY = 'ceramic-env';

    getCeramicClient({ apiKey: 'ceramic-explicit' });

    expect(Ceramic).toHaveBeenCalledWith({ apiKey: 'ceramic-explicit', fetch: expect.any(Function) });
  });

  it('creates the client only once when the lazy getter is first used', () => {
    const getClient = createLazyCeramicClient({ apiKey: 'ceramic-test' });

    expect(Ceramic).not.toHaveBeenCalled();
    expect(getClient()).toBe(getClient());
    expect(Ceramic).toHaveBeenCalledTimes(1);
  });
});
