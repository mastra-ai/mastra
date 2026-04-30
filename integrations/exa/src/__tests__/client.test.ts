import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const ExaCtor = vi.fn();

vi.mock('exa-js', () => {
  class FakeExa {
    headers: { set: (k: string, v: string) => void; get: (k: string) => string | undefined };
    search = vi.fn();
    findSimilar = vi.fn();
    getContents = vi.fn();
    answer = vi.fn();

    constructor(apiKey: string, baseURL?: string) {
      ExaCtor(apiKey, baseURL);
      const store = new Map<string, string>();
      this.headers = {
        set: (k: string, v: string) => {
          store.set(k, v);
        },
        get: (k: string) => store.get(k),
      };
    }
  }

  return { default: FakeExa };
});

import { getExaClient } from '../client.js';

describe('getExaClient', () => {
  const originalEnv = process.env.EXA_API_KEY;

  beforeEach(() => {
    ExaCtor.mockClear();
    delete process.env.EXA_API_KEY;
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.EXA_API_KEY = originalEnv;
    } else {
      delete process.env.EXA_API_KEY;
    }
  });

  it('throws if no API key is provided and env var is not set', () => {
    expect(() => getExaClient()).toThrow('Exa API key is required');
  });

  it('uses the API key from config', () => {
    getExaClient({ apiKey: 'test-key-123' });
    expect(ExaCtor).toHaveBeenCalledWith('test-key-123', undefined);
  });

  it('falls back to EXA_API_KEY env var', () => {
    process.env.EXA_API_KEY = 'env-key-456';
    getExaClient();
    expect(ExaCtor).toHaveBeenCalledWith('env-key-456', undefined);
  });

  it('prefers config.apiKey over env var', () => {
    process.env.EXA_API_KEY = 'env-key-456';
    getExaClient({ apiKey: 'config-key-789' });
    expect(ExaCtor).toHaveBeenCalledWith('config-key-789', undefined);
  });

  it('forwards baseURL to the SDK constructor', () => {
    getExaClient({ apiKey: 'test-key', baseURL: 'https://custom.example.com' });
    expect(ExaCtor).toHaveBeenCalledWith('test-key', 'https://custom.example.com');
  });

  it('sets the x-exa-integration tracking header to "mastra"', () => {
    const client = getExaClient({ apiKey: 'test-key' }) as unknown as {
      headers: { get: (k: string) => string | undefined };
    };
    expect(client.headers.get('x-exa-integration')).toBe('mastra');
  });

  it('returns a client with the expected method surface', () => {
    const client = getExaClient({ apiKey: 'test-key' });
    expect(client).toBeDefined();
    expect(client.search).toBeDefined();
    expect(client.findSimilar).toBeDefined();
    expect(client.getContents).toBeDefined();
    expect(client.answer).toBeDefined();
  });
});
