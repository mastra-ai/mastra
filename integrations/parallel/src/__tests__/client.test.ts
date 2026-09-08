import Parallel from 'parallel-web';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockSearch, mockExtract } = vi.hoisted(() => ({
  mockSearch: vi.fn(),
  mockExtract: vi.fn(),
}));

vi.mock('parallel-web', () => ({
  default: vi.fn(function ParallelClient() {
    return { search: mockSearch, extract: mockExtract };
  }),
}));

import { createLazyParallelClient, getParallelClient } from '../client.js';

describe('getParallelClient', () => {
  const originalApiKey = process.env.PARALLEL_API_KEY;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.PARALLEL_API_KEY;
  });

  afterEach(() => {
    if (originalApiKey === undefined) {
      delete process.env.PARALLEL_API_KEY;
    } else {
      process.env.PARALLEL_API_KEY = originalApiKey;
    }
  });

  it('throws a clear error when no API key is available', () => {
    expect(() => getParallelClient()).toThrow(
      'Parallel API key is required. Pass { apiKey } or set the PARALLEL_API_KEY environment variable.',
    );
    expect(Parallel).not.toHaveBeenCalled();
  });

  it('passes explicit client options to the official SDK', () => {
    getParallelClient({ apiKey: 'parallel-explicit', baseURL: 'https://parallel.example.test', maxRetries: 0 });

    expect(Parallel).toHaveBeenCalledWith({
      apiKey: 'parallel-explicit',
      baseURL: 'https://parallel.example.test',
      maxRetries: 0,
    });
  });

  it('falls back to PARALLEL_API_KEY', () => {
    process.env.PARALLEL_API_KEY = 'parallel-env';

    getParallelClient();

    expect(Parallel).toHaveBeenCalledWith({ apiKey: 'parallel-env' });
  });

  it('prefers an explicit API key over the environment', () => {
    process.env.PARALLEL_API_KEY = 'parallel-env';

    getParallelClient({ apiKey: 'parallel-explicit' });

    expect(Parallel).toHaveBeenCalledWith({ apiKey: 'parallel-explicit' });
  });

  it('creates the client only once when the lazy getter is first used', () => {
    const getClient = createLazyParallelClient({ apiKey: 'parallel-test' });

    expect(Parallel).not.toHaveBeenCalled();
    expect(getClient()).toBe(getClient());
    expect(Parallel).toHaveBeenCalledTimes(1);
  });
});
