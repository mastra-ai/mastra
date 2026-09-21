import { afterEach, expect, it, vi } from 'vitest';
import { Agent } from '../agent';
import type { MastraModelGatewayInterface } from '../llm/model/gateways';
import { GatewayManager } from '../llm/model/gateways';
import { Mastra } from '../mastra';
import { AgentController } from './agent-controller';

const gateway = (id: string, models = ['valid']): MastraModelGatewayInterface => ({
  id,
  name: id,
  fetchProviders: vi.fn(async () => ({
    provider: { name: 'Provider', gateway: id, models, apiKeyEnvVar: 'FIXTURE_KEY' },
  })),
  getApiKey: vi.fn(async () => 'fixture-only'),
  buildUrl: () => undefined,
  resolveLanguageModel: () => {
    throw new Error('Provider execution is forbidden in a catalog test');
  },
});
const controller = (gateways: MastraModelGatewayInterface[]) =>
  new AgentController({
    id: 'catalog-test',
    gateways,
    modes: [{ id: 'default' }],
    agent: new Agent({ id: 'test', name: 'Test', instructions: 'No calls', model: 'alpha/provider/valid' }),
  });
afterEach(() => vi.restoreAllMocks());

it('does not let a public registry advertise models owned by a custom gateway', async () => {
  const owner = gateway('alpha');
  const registry = gateway('models.dev');
  registry.fetchProviders = vi.fn(async () => ({
    alpha: { name: 'Public alpha', gateway: 'models.dev', models: ['unadmitted'], apiKeyEnvVar: 'FIXTURE_KEY' },
  }));
  owner.getApiKey = vi.fn(async id => {
    if (id !== 'alpha/provider/valid') throw new Error('Unadmitted model');
    return 'fixture-only';
  });
  const manager = new GatewayManager([owner, registry]);
  expect(await manager.listAvailableModels()).toEqual([
    expect.objectContaining({ id: 'alpha/provider/valid', hasApiKey: true }),
  ]);
  expect(owner.getApiKey).toHaveBeenCalledTimes(1);
  await expect(manager.resolveAuth('alpha/unadmitted')).rejects.toThrow('Unadmitted model');
});

it.each(['Missing FIXTURE_KEY environment variable', 'Credential service unavailable'])(
  'checks each model independently when another fails: %s',
  async message => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const source = gateway('alpha', ['broken', 'valid']);
    source.getApiKey = vi.fn(async id => {
      if (id.endsWith('/broken')) throw new Error(message);
      return 'fixture-only';
    });
    const manager = new GatewayManager([source]);
    expect(await manager.listAvailableModels()).toEqual([
      expect.objectContaining({ id: 'alpha/provider/broken', hasApiKey: false }),
      expect.objectContaining({ id: 'alpha/provider/valid', hasApiKey: true }),
    ]);
    await expect(manager.resolveAuth('alpha/provider/broken')).rejects.toThrow(message);
  },
);

it('keeps unrelated models when a provider catalog fails', async () => {
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  const broken = gateway('alpha');
  broken.fetchProviders = vi.fn(async () => {
    throw new Error('Catalog unavailable');
  });
  const manager = new GatewayManager([broken, gateway('beta')]);
  expect(await manager.listAvailableModels()).toEqual([
    expect.objectContaining({ id: 'beta/provider/valid', hasApiKey: true }),
  ]);
});

it('checks credentials concurrently with a bounded number of active requests', async () => {
  const names = Array.from({ length: 18 }, (_, index) => `model-${index}`);
  const source = gateway('alpha', names);
  let active = 0;
  let peak = 0;
  source.getApiKey = vi.fn(async () => {
    active++;
    peak = Math.max(peak, active);
    await new Promise(resolve => setTimeout(resolve, 1));
    active--;
    return 'fixture-only';
  });
  const models = await new GatewayManager([source]).listAvailableModels();
  expect(models.map(model => model.modelName)).toEqual(names);
  expect(models.every(model => model.hasApiKey)).toBe(true);
  expect(peak).toBeGreaterThan(1);
  expect(peak).toBeLessThanOrEqual(8);
});

it('refreshes changed catalogs on the same gateway after explicit invalidation', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json({})),
  );
  try {
    const source = gateway('alpha');
    const host = controller([source]);
    expect((await host.listAvailableModels())[0]?.modelName).toBe('valid');
    source.fetchProviders = gateway('alpha', ['updated']).fetchProviders;
    host.invalidateAvailableModelsCache();
    expect((await host.listAvailableModels())[0]?.modelName).toBe('updated');
  } finally {
    vi.unstubAllGlobals();
  }
});

it('refreshes newly registered gateways without waiting for cache expiry', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json({})),
  );
  try {
    const alpha = gateway('alpha');
    const host = controller([alpha]);
    const mastra = new Mastra({ gateways: { alpha }, agentControllers: { host } });
    expect((await host.listAvailableModels()).map(model => model.id)).toEqual(['alpha/provider/valid']);
    mastra.addGateway(gateway('beta'));
    // Auth must see the new parent gateway even before the next catalog read.
    expect(await host.getCurrentModelAuthStatus({ model: { get: () => 'beta/provider/valid' } } as never)).toEqual({
      hasAuth: true,
    });
    expect((await host.listAvailableModels()).map(model => model.id)).toEqual([
      'alpha/provider/valid',
      'beta/provider/valid',
    ]);
    host.invalidateAvailableModelsCache();
    expect((await host.listAvailableModels()).map(model => model.id)).toContain('beta/provider/valid');
    expect(await host.getCurrentModelAuthStatus({ model: { get: () => 'beta/provider/valid' } } as never)).toEqual({
      hasAuth: true,
    });
  } finally {
    vi.unstubAllGlobals();
  }
});

it('does not let an older in-flight list replace a newer publication cache', async () => {
  let release!: (value: Awaited<ReturnType<GatewayManager['listAvailableModels']>>) => void;
  vi.spyOn(GatewayManager.prototype, 'listAvailableModels')
    .mockImplementationOnce(
      () =>
        new Promise(resolve => {
          release = resolve;
        }),
    )
    .mockResolvedValueOnce([
      { id: 'alpha/provider/new', provider: 'alpha/provider', modelName: 'new', hasApiKey: true },
    ]);
  const host = controller([gateway('alpha')]);
  const older = host.listAvailableModels();
  host.invalidateAvailableModelsCache();
  const newer = await host.listAvailableModels();
  release([{ id: 'alpha/provider/old', provider: 'alpha/provider', modelName: 'old', hasApiKey: true }]);
  await older;
  expect(await host.listAvailableModels()).toEqual(newer);
  expect(newer[0]?.id).toBe('alpha/provider/new');
});
