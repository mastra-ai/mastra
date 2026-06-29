import { describe, expect, it, vi } from 'vitest';
import type { ObservabilityEntrypoint, ObservabilityExporter, ObservabilityInstance } from '../observability';
import { Mastra } from './index';

function createMockExporter(name = 'test-exporter'): ObservabilityExporter {
  return {
    name,
    exportTracingEvent: vi.fn().mockResolvedValue(undefined),
    flush: vi.fn().mockResolvedValue(undefined),
    shutdown: vi.fn().mockResolvedValue(undefined),
  };
}

function createMockInstance(exporters: ObservabilityExporter[] = []): ObservabilityInstance {
  const registered = [...exporters];
  return {
    getConfig: vi.fn().mockReturnValue({ serviceName: 'test', exporters: registered }),
    getExporters: vi.fn(() => [...registered]),
    getSpanOutputProcessors: vi.fn().mockReturnValue([]),
    getLogger: vi.fn().mockReturnValue(undefined),
    getBridge: vi.fn().mockReturnValue(undefined),
    startSpan: vi.fn(),
    rebuildSpan: vi.fn(),
    flush: vi.fn().mockResolvedValue(undefined),
    shutdown: vi.fn().mockResolvedValue(undefined),
    __setLogger: vi.fn(),
    registerExporter: vi.fn((exporter: ObservabilityExporter) => {
      registered.push(exporter);
    }),
  } as unknown as ObservabilityInstance;
}

function createMockEntrypoint(defaultInstance?: ObservabilityInstance): ObservabilityEntrypoint {
  const instances = new Map<string, ObservabilityInstance>();
  let _default = defaultInstance;

  return {
    shutdown: vi.fn().mockResolvedValue(undefined),
    setMastraContext: vi.fn(),
    setLogger: vi.fn(),
    getSelectedInstance: vi.fn().mockReturnValue(undefined),
    registerInstance: vi.fn((name: string, instance: ObservabilityInstance, isDefault?: boolean) => {
      instances.set(name, instance);
      if (isDefault) _default = instance;
    }),
    getInstance: vi.fn((name: string) => instances.get(name)),
    getDefaultInstance: vi.fn(() => _default),
    listInstances: vi.fn(() => instances),
    unregisterInstance: vi.fn().mockReturnValue(false),
    hasInstance: vi.fn().mockReturnValue(false),
    setConfigSelector: vi.fn(),
    clear: vi.fn(),
  };
}

describe('Mastra.registerExporter()', () => {
  it('should bootstrap observability when current is NoOp', () => {
    const mastra = new Mastra({ logger: false });
    const exporter = createMockExporter();
    const instance = createMockInstance([exporter]);
    const entrypoint = createMockEntrypoint();

    mastra.registerExporter(exporter, instance, entrypoint);

    expect(entrypoint.setLogger).toHaveBeenCalled();
    expect(entrypoint.setMastraContext).toHaveBeenCalledWith({ mastra });
    expect(entrypoint.registerInstance).toHaveBeenCalledWith('default', instance, true);
    expect(mastra.observability.getDefaultInstance()).toBe(instance);
  });

  it('should add exporter to existing default instance when observability is configured', () => {
    const existingInstance = createMockInstance();
    const entrypoint = createMockEntrypoint(existingInstance);

    const mastra = new Mastra({
      logger: false,
      observability: entrypoint as any,
    });

    const exporter = createMockExporter('cloud-exporter');
    const fallbackInstance = createMockInstance([exporter]);

    mastra.registerExporter(exporter, fallbackInstance, entrypoint);

    expect(existingInstance.registerExporter).toHaveBeenCalledWith(exporter);
    // Should NOT have registered the fallback instance
    expect(entrypoint.registerInstance).not.toHaveBeenCalled();
    expect(mastra.observability.getDefaultInstance()).toBe(existingInstance);
  });

  it('should not call registerInstance when already has real observability', () => {
    const existingInstance = createMockInstance();
    const entrypoint = createMockEntrypoint(existingInstance);

    const mastra = new Mastra({
      logger: false,
      observability: entrypoint as any,
    });

    const exporter = createMockExporter();
    const instance = createMockInstance([exporter]);

    mastra.registerExporter(exporter, instance, entrypoint);

    // setMastraContext should NOT have been called again (it was only called in constructor)
    expect(entrypoint.setMastraContext).toHaveBeenCalledTimes(1); // constructor only
  });

  it('should use no default observability instance for default no-op configuration', () => {
    const mastra = new Mastra({ logger: false });

    expect(mastra.observability.getDefaultInstance()).toBeUndefined();
  });
});
