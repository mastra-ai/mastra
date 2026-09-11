import { describe, expect, it, vi } from 'vitest';

import { CustomProviderPresets } from './presets.js';

function fakeFetch(models: string[], status = 200) {
  return vi.fn(async () => new Response(JSON.stringify({ data: models.map(id => ({ id })) }), { status }));
}

describe('CustomProviderPresets', () => {
  it('lists a preset with static models for the requested org without touching the network', async () => {
    const fetchImpl = fakeFetch(['unused']);
    const presets = new CustomProviderPresets(
      [{ name: 'Team Proxy', url: 'https://llm.example.com/v1', apiKey: 'sk', models: ['fast'] }],
      fetchImpl,
    );

    const records = await presets.records('org-1');

    expect(records).toEqual([
      expect.objectContaining({
        orgId: 'org-1',
        providerId: 'team-proxy',
        name: 'Team Proxy',
        url: 'https://llm.example.com/v1',
        apiKey: 'sk',
        models: ['fast'],
        preset: true,
      }),
    ]);
    expect(presets.has('team-proxy')).toBe(true);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('discovers models from the provider once and serves them from cache', async () => {
    const fetchImpl = fakeFetch(['smart', 'fast']);
    const presets = new CustomProviderPresets(
      [{ name: 'Proxy', url: 'https://llm.example.com/v1/', apiKey: 'sk' }],
      fetchImpl,
    );

    const [first] = await presets.records('org-1');
    const [second] = await presets.records('org-2');

    expect(first?.models).toEqual(['fast', 'smart']);
    expect(second?.models).toEqual(['fast', 'smart']);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://llm.example.com/v1/models',
      expect.objectContaining({ headers: { Authorization: 'Bearer sk' } }),
    );
  });

  it('serves an empty list when discovery fails and retries on the next read', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response('nope', { status: 500 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ id: 'fast' }] }), { status: 200 }));
    const presets = new CustomProviderPresets([{ name: 'Proxy', url: 'https://llm.example.com/v1' }], fetchImpl);

    expect((await presets.records('org-1'))[0]?.models).toEqual([]);
    expect((await presets.records('org-1'))[0]?.models).toEqual(['fast']);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });
});
