import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const registrySyncGateways = vi.fn();
const registryGetLastRefreshTime = vi.fn<() => Date | null>();
const registryGetInstance = vi.fn(() => ({
  syncGateways: registrySyncGateways,
  getLastRefreshTime: registryGetLastRefreshTime,
}));

vi.mock('@mastra/core/llm', () => ({
  GatewayRegistry: {
    getInstance: registryGetInstance,
  },
}));

describe('gateway-sync wrapper', () => {
  beforeEach(() => {
    vi.resetModules();
    registrySyncGateways.mockReset();
    registrySyncGateways.mockResolvedValue(undefined);
    registryGetLastRefreshTime.mockReset();
    registryGetLastRefreshTime.mockReturnValue(null);
    registryGetInstance.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('delegates to GatewayRegistry.syncGateways with dynamic loading enabled', async () => {
    const { syncGateways } = await import('../gateway-sync.js');

    await syncGateways(true);

    expect(registryGetInstance).toHaveBeenCalledWith({ useDynamicLoading: true });
    expect(registrySyncGateways).toHaveBeenCalledWith(true);
  });

  it('skips the network sync when the global cache was refreshed recently', async () => {
    registryGetLastRefreshTime.mockReturnValue(new Date(Date.now() - 60_000));
    const { syncGateways } = await import('../gateway-sync.js');

    await syncGateways();

    expect(registrySyncGateways).not.toHaveBeenCalled();
  });

  it('runs the sync when the last refresh is older than the interval', async () => {
    registryGetLastRefreshTime.mockReturnValue(new Date(Date.now() - 10 * 60_000));
    const { syncGateways } = await import('../gateway-sync.js');

    await syncGateways();

    expect(registrySyncGateways).toHaveBeenCalledWith(true);
  });

  it('runs the sync when no previous refresh time is recorded', async () => {
    registryGetLastRefreshTime.mockReturnValue(null);
    const { syncGateways } = await import('../gateway-sync.js');

    await syncGateways();

    expect(registrySyncGateways).toHaveBeenCalledWith(true);
  });

  it('always syncs when force=true even if recently refreshed', async () => {
    registryGetLastRefreshTime.mockReturnValue(new Date(Date.now() - 1_000));
    const { syncGateways } = await import('../gateway-sync.js');

    await syncGateways(true);

    expect(registrySyncGateways).toHaveBeenCalledWith(true);
  });

  it('does not throw when the registry sync rejects', async () => {
    registrySyncGateways.mockRejectedValueOnce(new Error('boom'));
    const { syncGateways } = await import('../gateway-sync.js');

    // Should resolve without throwing even when the underlying sync rejects
    await expect(syncGateways(true)).resolves.toBeUndefined();
  });

  it('startGatewaySync schedules a periodic sync that clears on stop', async () => {
    vi.useFakeTimers();
    registryGetLastRefreshTime.mockReturnValue(null);
    const { startGatewaySync, stopGatewaySync } = await import('../gateway-sync.js');

    startGatewaySync(1_000);
    // Initial sync fires immediately (skip-if-recent passed because no prior refresh)
    await vi.advanceTimersByTimeAsync(0);
    expect(registrySyncGateways).toHaveBeenCalledTimes(1);

    // Mark "recently synced" so the next interval tick should skip
    registryGetLastRefreshTime.mockReturnValue(new Date());
    await vi.advanceTimersByTimeAsync(1_000);
    expect(registrySyncGateways).toHaveBeenCalledTimes(1);

    stopGatewaySync();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(registrySyncGateways).toHaveBeenCalledTimes(1);
  });
});
