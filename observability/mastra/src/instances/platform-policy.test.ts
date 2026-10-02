import { Mastra } from '@mastra/core/mastra';
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
    expect(warnSpy).toHaveBeenCalledWith('Storage exporter registration skipped on Mastra Platform', {
      exporterName: 'mastra-storage-exporter',
      serviceName: 'test-service',
      instanceName: 'default',
    });
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
