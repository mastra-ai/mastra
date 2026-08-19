import { describe, expect, it, vi } from 'vitest';

import { PiModelAdapter, type PiModelHost } from '../model-adapter.js';
import { MastraPiExtensionGeneration } from '../runtime.js';

function fixture() {
  const generation = new MastraPiExtensionGeneration('plugin', 'extension', '/tmp/entry.ts');
  let modelId = 'provider/allowed';
  let thinking = 'medium';
  const host: PiModelHost = {
    getCurrentModelId: () => modelId,
    listAvailableModels: vi.fn().mockResolvedValue([
      { id: 'provider/allowed', hasApiKey: true },
      { id: 'provider/no-key', hasApiKey: false },
    ]),
    switchModel: vi.fn().mockImplementation(async id => {
      modelId = id;
    }),
    getThinkingLevel: () => thinking,
    setThinkingLevel: vi.fn().mockImplementation(level => {
      thinking = level;
    }),
  };
  return { generation, host, adapter: new PiModelAdapter(generation, () => host) };
}

describe('Pi model adapter', () => {
  it('enforces the host model allowlist and credential policy', async () => {
    const { adapter, host, generation } = fixture();
    await expect(adapter.setModel('provider/allowed')).resolves.toBe(true);
    await expect(adapter.setModel('provider/no-key')).resolves.toBe(false);
    await expect(adapter.setModel('provider/missing')).resolves.toBe(false);
    expect(host.switchModel).toHaveBeenCalledOnce();
    expect(
      generation.compatibility.diagnostics.filter(diagnostic => diagnostic.capability === 'setModel'),
    ).toHaveLength(2);
  });

  it('maps current/scoped models and thinking level without exposing the registry', async () => {
    const { adapter } = fixture();
    expect(adapter.getModel()).toBe('provider/allowed');
    expect(await adapter.getScopedModels()).toEqual([{ id: 'provider/allowed', hasApiKey: true }]);
    await adapter.setThinkingLevel('high');
    expect(adapter.getThinkingLevel()).toBe('high');
  });
});
