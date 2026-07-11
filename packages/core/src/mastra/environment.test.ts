import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ObservabilityEntrypoint, ObservabilityInstance } from '../observability';
import { Mastra } from './index';

/**
 * Build a minimal mock ObservabilityEntrypoint that captures the
 * `__setMastraEnvironment` call propagated by `setMastraContext`.
 */
function createMockEntrypoint() {
  const setEnv = vi.fn();
  const instance = {
    getConfig: vi.fn().mockReturnValue({ serviceName: 'test' }),
    getExporters: vi.fn().mockReturnValue([]),
    getSpanOutputProcessors: vi.fn().mockReturnValue([]),
    getLogger: vi.fn().mockReturnValue(undefined),
    getBridge: vi.fn().mockReturnValue(undefined),
    startSpan: vi.fn(),
    rebuildSpan: vi.fn(),
    flush: vi.fn().mockResolvedValue(undefined),
    shutdown: vi.fn().mockResolvedValue(undefined),
    __setLogger: vi.fn(),
    __setMastraEnvironment: setEnv,
  } as unknown as ObservabilityInstance;

  const instances = new Map<string, ObservabilityInstance>([['default', instance]]);

  const setMastraContext = vi.fn(({ mastra }: { mastra: Mastra }) => {
    instances.forEach(i => {
      i.__setMastraEnvironment?.(mastra.getEnvironment());
    });
  });

  const entrypoint: ObservabilityEntrypoint = {
    shutdown: vi.fn().mockResolvedValue(undefined),
    setMastraContext,
    setLogger: vi.fn(),
    getSelectedInstance: vi.fn().mockReturnValue(undefined),
    registerInstance: vi.fn(),
    getInstance: vi.fn(),
    getDefaultInstance: vi.fn(() => instance),
    listInstances: vi.fn(() => instances),
    unregisterInstance: vi.fn().mockReturnValue(false),
    hasInstance: vi.fn().mockReturnValue(false),
    setConfigSelector: vi.fn(),
    clear: vi.fn(),
  };

  return { entrypoint, setEnv, setMastraContext };
}

describe('Mastra `environment` config', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    delete process.env.NODE_ENV;
  });

  afterEach(() => {
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it('returns the explicit config value from getEnvironment()', () => {
    const mastra = new Mastra({ logger: false, environment: 'production' });
    expect(mastra.getEnvironment()).toBe('production');
  });

  it('falls back to process.env.NODE_ENV when environment is not set', () => {
    process.env.NODE_ENV = 'staging';
    const mastra = new Mastra({ logger: false });
    expect(mastra.getEnvironment()).toBe('staging');
  });

  it('returns undefined when neither environment nor NODE_ENV is set', () => {
    const mastra = new Mastra({ logger: false });
    expect(mastra.getEnvironment()).toBeUndefined();
  });

  it('prefers explicit environment over NODE_ENV', () => {
    process.env.NODE_ENV = 'production';
    const mastra = new Mastra({ logger: false, environment: 'staging' });
    expect(mastra.getEnvironment()).toBe('staging');
  });

  it('propagates the resolved environment to observability via setMastraContext', () => {
    const { entrypoint, setEnv, setMastraContext } = createMockEntrypoint();

    new Mastra({
      logger: false,
      environment: 'production',
      observability: entrypoint,
    });

    expect(setMastraContext).toHaveBeenCalledTimes(1);
    expect(setEnv).toHaveBeenCalledWith('production');
  });

  it('propagates the NODE_ENV fallback to observability', () => {
    process.env.NODE_ENV = 'staging';
    const { entrypoint, setEnv } = createMockEntrypoint();

    new Mastra({ logger: false, observability: entrypoint });

    expect(setEnv).toHaveBeenCalledWith('staging');
  });

  it('propagates undefined when no environment is configured', () => {
    const { entrypoint, setEnv } = createMockEntrypoint();

    new Mastra({ logger: false, observability: entrypoint });

    expect(setEnv).toHaveBeenCalledWith(undefined);
  });
});
