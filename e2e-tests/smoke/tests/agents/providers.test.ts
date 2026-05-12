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

  it('should include Mastra gateway as a connected provider', async () => {
    const { data } = await fetchJson<any>('/api/agents/providers');

    const mastra = data.providers.find((p: any) => p.id === 'mastra');
    expect(mastra, 'Mastra provider not found in provider list').toBeDefined();
    expect(mastra.connected).toBe(true);
  });
});
