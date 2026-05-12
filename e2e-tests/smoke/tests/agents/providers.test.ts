import { describe, it, expect } from 'vitest';
import { fetchJson } from '../utils.js';

describe('agent providers', () => {
  it('should list available providers', async () => {
    const { status, data } = await fetchJson<any>('/api/agents/providers');

    expect(status).toBe(200);
    expect(data.providers.length).toBeGreaterThan(0);

    // Each provider should have the expected shape
    const provider = data.providers[0];
    expect(provider.id).toBeDefined();
    expect(provider.name).toBeDefined();
    expect(typeof provider.connected).toBe('boolean');
  });

  it('should include OpenAI as a connected provider', async () => {
    const { data } = await fetchJson<any>('/api/agents/providers');

    const openai = data.providers.find((p: any) => p.id === 'openai');
    expect(openai, 'OpenAI provider not found in provider list').toBeDefined();
    expect(openai.connected).toBe(true);
  });
});
