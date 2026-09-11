import type { Mastra } from '@mastra/core/mastra';
import type { InitExporterOptions, TracingEvent } from '@mastra/core/observability';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Observability } from '../default';
import { BaseExporter } from '../exporters/base';
import { CloudExporter } from '../exporters/cloud';
import { DefaultExporter } from '../exporters/default';
import { MastraPlatformExporter } from '../exporters/mastra-platform';
import { MastraStorageExporter } from '../exporters/mastra-storage';
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
  it('keeps MastraStorageExporter when the Platform access token is absent', () => {
    vi.stubEnv('MASTRA_PLATFORM_ACCESS_TOKEN', undefined);
    const storageExporter = new MastraStorageExporter();

    const instance = createInstance([storageExporter]);

    expect(instance.getExporters()).toEqual([storageExporter]);
    expect(instance.getConfig().exporters).toEqual([storageExporter]);
    expect(instance.getObservabilityBus().getExporters()).toEqual([storageExporter]);
  });

  it('treats an empty Platform access token as absent', () => {
    vi.stubEnv('MASTRA_PLATFORM_ACCESS_TOKEN', '');
    const storageExporter = new MastraStorageExporter();

    const instance = createInstance([storageExporter]);

    expect(instance.getExporters()).toEqual([storageExporter]);
  });

  it('removes MastraStorageExporter before registration when the Platform access token is present', () => {
    vi.stubEnv('MASTRA_PLATFORM_ACCESS_TOKEN', 'platform-token');
    const storageExporter = new MastraStorageExporter();

    const instance = createInstance([storageExporter]);

    expect(instance.getExporters()).toEqual([]);
    expect(instance.getConfig().exporters).toEqual([]);
    expect(instance.getObservabilityBus().getExporters()).toEqual([]);
  });

  it('removes the deprecated DefaultExporter when the Platform access token is present', () => {
    vi.stubEnv('MASTRA_PLATFORM_ACCESS_TOKEN', 'platform-token');
    const storageExporter = new DefaultExporter();

    const instance = createInstance([storageExporter]);

    expect(instance.getExporters()).toEqual([]);
  });

  it('logs the storage exporters superseded by Mastra Platform', () => {
    vi.stubEnv('MASTRA_PLATFORM_ACCESS_TOKEN', 'platform-token');
    const instance = createInstance([new MastraStorageExporter(), new DefaultExporter()]);
    const info = vi.fn();

    instance.__setLogger({
      debug: vi.fn(),
      info,
      warn: vi.fn(),
      error: vi.fn(),
      trackException: vi.fn(),
      getTransports: () => new Map(),
      listLogs: vi.fn(),
      listLogsByRunId: vi.fn(),
    });

    expect(info).toHaveBeenCalledWith(
      '[Observability] Storage exporters superseded by Mastra Platform [service=test-service] [instance=default] [exporters=mastra-storage-exporter,mastra-default-observability-exporter]',
    );
  });

  it('retains Platform, legacy Cloud, and custom exporters in their original order', async () => {
    vi.stubEnv('MASTRA_PLATFORM_ACCESS_TOKEN', 'platform-token');
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
    vi.stubEnv('MASTRA_PLATFORM_ACCESS_TOKEN', 'platform-token');
    const firstCustomExporter = new CustomExporter();
    const secondCustomExporter = new CustomExporter();

    const firstInstance = createInstance([new MastraStorageExporter(), firstCustomExporter], 'first');
    const secondInstance = createInstance([new DefaultExporter(), secondCustomExporter], 'second');

    expect(firstInstance.getExporters()).toEqual([firstCustomExporter]);
    expect(secondInstance.getExporters()).toEqual([secondCustomExporter]);
  });

  it('does not initialize a superseded storage exporter after setting the Mastra context', () => {
    vi.stubEnv('MASTRA_PLATFORM_ACCESS_TOKEN', 'platform-token');
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
