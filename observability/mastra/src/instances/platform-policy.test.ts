import { Mastra } from '@mastra/core/mastra';
import { SpanType } from '@mastra/core/observability';
import type { InitExporterOptions, TracingEvent } from '@mastra/core/observability';
import { InMemoryStore } from '@mastra/core/storage';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Observability } from '../default';
import { BaseExporter } from '../exporters/base';
import { CloudExporter } from '../exporters/cloud';
import { DefaultExporter } from '../exporters/default';
import { MastraPlatformExporter } from '../exporters/mastra-platform';
import { MastraStorageExporter } from '../exporters/mastra-storage';
import { TestExporter } from '../exporters/test';
import { DefaultObservabilityInstance } from './default';

class CustomExporter extends BaseExporter {
  name = 'custom-exporter';

  protected async _exportTracingEvent(_event: TracingEvent): Promise<void> {}
}

class TrackingStorageExporter extends MastraStorageExporter {
  readonly initSpy = vi.fn();

  override async init(options: InitExporterOptions): Promise<void> {
    this.initSpy(options);
  }
}

function createInstance(exporters: BaseExporter[], name = 'default'): DefaultObservabilityInstance {
  return new DefaultObservabilityInstance({
    name,
    serviceName: 'test-service',
    exporters,
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('Platform storage exporter supersession', () => {
  it('keeps MastraStorageExporter when the Platform deployment ID is absent', () => {
    vi.stubEnv('MASTRA_DEPLOYMENT_ID', undefined);
    const storageExporter = new MastraStorageExporter();

    const instance = createInstance([storageExporter]);

    expect(instance.getExporters()).toEqual([storageExporter]);
    expect(instance.getConfig().exporters).toEqual([storageExporter]);
    expect(instance.getObservabilityBus().getExporters()).toEqual([storageExporter]);
  });

  it('treats an empty Platform deployment ID as absent', () => {
    vi.stubEnv('MASTRA_DEPLOYMENT_ID', '');
    const storageExporter = new MastraStorageExporter();

    const instance = createInstance([storageExporter]);

    expect(instance.getExporters()).toEqual([storageExporter]);
  });

  it('keeps MastraStorageExporter when only the Platform access token is present', () => {
    vi.stubEnv('MASTRA_DEPLOYMENT_ID', undefined);
    vi.stubEnv('MASTRA_PLATFORM_ACCESS_TOKEN', 'platform-token');
    const storageExporter = new MastraStorageExporter();

    const instance = createInstance([storageExporter]);

    expect(instance.getExporters()).toEqual([storageExporter]);
  });

  it('removes MastraStorageExporter before registration when the Platform deployment ID is present', () => {
    vi.stubEnv('MASTRA_DEPLOYMENT_ID', 'deployment-id');
    const storageExporter = new MastraStorageExporter();

    const instance = createInstance([storageExporter]);

    expect(instance.getExporters()).toEqual([]);
    expect(instance.getConfig().exporters).toEqual([]);
    expect(instance.getObservabilityBus().getExporters()).toEqual([]);
  });

  it('removes the deprecated DefaultExporter when the Platform deployment ID is present', () => {
    vi.stubEnv('MASTRA_DEPLOYMENT_ID', 'deployment-id');
    const storageExporter = new DefaultExporter();

    const instance = createInstance([storageExporter]);

    expect(instance.getExporters()).toEqual([]);
  });

  it.each(['mastra-storage-exporter', 'mastra-default-observability-exporter'])(
    'removes a built-in storage exporter from another package copy by name: %s',
    exporterName => {
      vi.stubEnv('MASTRA_DEPLOYMENT_ID', 'deployment-id');
      const storageExporter = new CustomExporter();
      storageExporter.name = exporterName;

      const instance = createInstance([storageExporter]);

      expect(instance.getExporters()).toEqual([]);
      expect(instance.getConfig().exporters).toEqual([]);
      expect(instance.getObservabilityBus().getExporters()).toEqual([]);
    },
  );

  it('retains Platform, legacy Cloud, and custom exporters in their original order', async () => {
    vi.stubEnv('MASTRA_DEPLOYMENT_ID', 'deployment-id');
    const storageExporter = new MastraStorageExporter();
    const platformExporter = new MastraPlatformExporter();
    const cloudExporter = new CloudExporter({ accessToken: 'cloud-token' });
    const customExporter = new CustomExporter();

    const instance = createInstance([storageExporter, platformExporter, cloudExporter, customExporter]);

    expect(instance.getExporters()).toEqual([platformExporter, cloudExporter, customExporter]);
    expect(instance.getConfig().exporters).toEqual([platformExporter, cloudExporter, customExporter]);
    expect(instance.getObservabilityBus().getExporters()).toEqual([platformExporter, cloudExporter, customExporter]);

    await Promise.all([platformExporter.shutdown(), cloudExporter.shutdown()]);
  });

  it('applies supersession to every SDK observability instance', () => {
    vi.stubEnv('MASTRA_DEPLOYMENT_ID', 'deployment-id');
    const firstCustomExporter = new CustomExporter();
    const secondCustomExporter = new CustomExporter();

    const firstInstance = createInstance([new MastraStorageExporter(), firstCustomExporter], 'first');
    const secondInstance = createInstance([new DefaultExporter(), secondCustomExporter], 'second');

    expect(firstInstance.getExporters()).toEqual([firstCustomExporter]);
    expect(secondInstance.getExporters()).toEqual([secondCustomExporter]);
  });

  it('ignores a storage exporter registered through Mastra on a Platform deployment', () => {
    vi.stubEnv('MASTRA_DEPLOYMENT_ID', 'deployment-id');
    const customExporter = new CustomExporter();
    const instance = createInstance([customExporter]);
    const observability = new Observability({
      configs: { default: instance },
      sensitiveDataFilter: false,
    });
    const mastra = new Mastra({ logger: false, observability });
    const storageExporter = new MastraStorageExporter();
    const warnSpy = vi.spyOn(instance.getLogger(), 'warn');

    mastra.registerExporter(storageExporter, createInstance([], 'fallback'), observability);

    expect(instance.getExporters()).toEqual([customExporter]);
    expect(instance.getConfig().exporters).toEqual([customExporter]);
    expect(instance.getObservabilityBus().getExporters()).toEqual([customExporter]);
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy).toHaveBeenCalledWith(
      'Storage exporter skipped on Mastra Platform. Set allowStorageOnPlatform: true on this observability config to allow remote storage export.',
      {
        exporterName: 'mastra-storage-exporter',
        serviceName: 'test-service',
        instanceName: 'default',
      },
    );
  });

  it('registers a storage exporter through Mastra outside a Platform deployment', () => {
    vi.stubEnv('MASTRA_DEPLOYMENT_ID', undefined);
    const customExporter = new CustomExporter();
    const instance = createInstance([customExporter]);
    const observability = new Observability({
      configs: { default: instance },
      sensitiveDataFilter: false,
    });
    const mastra = new Mastra({ logger: false, observability });
    const storageExporter = new MastraStorageExporter();
    const warnSpy = vi.spyOn(instance.getLogger(), 'warn');

    mastra.registerExporter(storageExporter, createInstance([], 'fallback'), observability);

    expect(instance.getExporters()).toEqual([customExporter, storageExporter]);
    expect(instance.getConfig().exporters).toEqual([customExporter, storageExporter]);
    expect(instance.getObservabilityBus().getExporters()).toEqual([customExporter, storageExporter]);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('does not initialize a superseded storage exporter after setting the Mastra context', () => {
    vi.stubEnv('MASTRA_DEPLOYMENT_ID', 'deployment-id');
    const storageExporter = new TrackingStorageExporter();
    const observability = new Observability({
      configs: {
        default: {
          serviceName: 'test-service',
          exporters: [storageExporter],
        },
      },
      sensitiveDataFilter: false,
    });

    observability.setMastraContext({
      mastra: { getEnvironment: () => undefined } as Mastra,
    });

    expect(storageExporter.initSpy).not.toHaveBeenCalled();
  });
});

describe('Opt-in storage export on Platform', () => {
  it.each([undefined, false, true])(
    'exports to a second destination and persists customer traces only with allowStorageOnPlatform=%s',
    async allowStorageOnPlatform => {
      vi.stubEnv('MASTRA_DEPLOYMENT_ID', 'deployment-id');
      const mirror = new TestExporter();
      const storage = new InMemoryStore();
      const observability = new Observability({
        configs: {
          default: {
            serviceName: 'customer-app',
            allowStorageOnPlatform,
            exporters: [new MastraStorageExporter(), mirror],
          },
        },
      });
      const mastra = new Mastra({ storage, observability, logger: false });
      try {
        const instance = observability.getDefaultInstance()!;
        const span = instance.startSpan({ type: SpanType.GENERIC, name: 'customer operation' });
        instance.getLoggerContext?.(span).warn('customer log');
        span.end({ output: 'completed' });
        await instance.flush();

        expect(mirror.getSpansByType(SpanType.GENERIC)).toEqual(
          expect.arrayContaining([expect.objectContaining({ traceId: span.traceId, name: 'customer operation' })]),
        );
        const store = (await storage.getStore('observability'))!;
        expect(mirror.getLogsByTraceId(span.traceId)).toEqual([expect.objectContaining({ message: 'customer log' })]);
        const logs = await store.listLogs({ filters: { traceId: span.traceId } });
        const result = await store.getSpan({ traceId: span.traceId, spanId: span.id });
        if (allowStorageOnPlatform) {
          expect(logs.logs).toEqual([expect.objectContaining({ message: 'customer log' })]);
          expect(result?.span).toMatchObject({ name: 'customer operation', output: 'completed' });
        } else {
          expect(logs.logs).toEqual([]);
          expect(result?.span ?? null).toBeNull();
        }
      } finally {
        await mastra.shutdown();
      }
    },
  );

  it.each([
    { name: 'MastraStorageExporter', Exporter: MastraStorageExporter },
    { name: 'DefaultExporter', Exporter: DefaultExporter },
  ])('allows late registration of $name only on the opted-in instance', async ({ Exporter }) => {
    vi.stubEnv('MASTRA_DEPLOYMENT_ID', 'deployment-id');
    const enabled = new DefaultObservabilityInstance({
      name: 'enabled',
      serviceName: 'customer-app',
      allowStorageOnPlatform: true,
    });
    const disabled = createInstance([], 'disabled');
    const exporter = new Exporter();
    enabled.registerExporter(exporter);
    disabled.registerExporter(new Exporter());
    const storage = new InMemoryStore();
    const observability = new Observability({ configs: { enabled, disabled }, configSelector: () => 'enabled' });
    const mastra = new Mastra({ storage, observability, logger: false });
    try {
      const kept = enabled.startSpan({ type: SpanType.GENERIC, name: 'kept' });
      kept.end();
      const skipped = disabled.startSpan({ type: SpanType.GENERIC, name: 'skipped' });
      skipped.end();
      await Promise.all([enabled.flush(), disabled.flush()]);
      const store = (await storage.getStore('observability'))!;
      expect((await store.getSpan({ traceId: kept.traceId, spanId: kept.id }))?.span).toMatchObject({ name: 'kept' });
      expect((await store.getSpan({ traceId: skipped.traceId, spanId: skipped.id }))?.span ?? null).toBeNull();
    } finally {
      await mastra.shutdown();
    }
  });
});

describe.each([
  { name: 'MastraStorageExporter', Exporter: MastraStorageExporter },
  { name: 'DefaultExporter', Exporter: DefaultExporter },
])('$name local storage protection', ({ Exporter }) => {
  it.each([
    { deploymentId: 'deployment-id', location: 'local', blocked: true },
    { deploymentId: 'deployment-id', location: 'remote', blocked: false },
    { deploymentId: undefined, location: 'local', blocked: false },
  ])('persists only to permitted storage ($deploymentId, $location)', async ({ deploymentId, location, blocked }) => {
    vi.stubEnv('MASTRA_DEPLOYMENT_ID', deploymentId);
    const storage = new InMemoryStore();
    const store = (await storage.getStore('observability'))!;
    // Exercise each adapter capability with real in-memory persistence; adapter
    // tests separately verify how libSQL and DuckDB report their location.
    Object.defineProperty(store, 'persistenceLocation', { value: location });
    const exporter = new Exporter();
    const mirror = new TestExporter();
    const observability = new Observability({
      configs: {
        default: {
          serviceName: 'customer-app',
          allowStorageOnPlatform: true,
          exporters: [exporter, mirror],
        },
      },
    });
    const mastra = new Mastra({ storage, observability, logger: false });
    const warn = vi.spyOn(observability.getDefaultInstance()!.getLogger(), 'warn');
    try {
      // Wait for exporter initialization, without sending any events.
      await observability.getDefaultInstance()!.flush();
      expect(warn).toHaveBeenCalledTimes(blocked ? 1 : 0);
      if (blocked) expect(warn).toHaveBeenCalledWith(expect.stringContaining('local observability storage'));
      const instance = observability.getDefaultInstance()!;
      for (let i = 0; i < 2; i++) {
        const span = instance.startSpan({ type: SpanType.GENERIC, name: 'customer operation' });
        instance.getLoggerContext?.(span).warn('customer log');
        span.end();
        await instance.flush();
        const result = await store.getSpan({ traceId: span.traceId, spanId: span.id });
        const logs = await store.listLogs({ filters: { traceId: span.traceId } });
        expect(Boolean(result?.span)).toBe(!blocked);
        expect(logs.logs).toHaveLength(blocked ? 0 : 1);
        expect(mirror.getLogsByTraceId(span.traceId)).toHaveLength(1);
      }
      // Blocked storage stays disabled without repeating warnings per event.
      expect(warn).toHaveBeenCalledTimes(blocked ? 1 : 0);
    } finally {
      warn.mockRestore();
      await mastra.shutdown();
    }
  });
});
