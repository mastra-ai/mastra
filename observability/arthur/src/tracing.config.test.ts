import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ArthurExporter } from './tracing';

// Mock OtelExporter to spy on its constructor
vi.mock('@mastra/otel-exporter', () => {
  const OtelExporter = vi.fn().mockImplementation(function (this: any) {
    this.exportTracingEvent = vi.fn();
    this.shutdown = vi.fn();
    this.setDisabled = vi.fn();
    this.logger = {
      warn: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
    };
  });
  // Add init to prototype so super.init() works
  OtelExporter.prototype.init = vi.fn();
  return { OtelExporter };
});

describe('ArthurExporterConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clean env vars between tests
    delete process.env.ARTHUR_API_KEY;
    delete process.env.ARTHUR_BASE_URL;
    delete process.env.ARTHUR_TASK_ID;
  });

  it('configures with explicit apiKey and endpoint', async () => {
    const { OtelExporter } = await import('@mastra/otel-exporter');
    const otelExporterSpy = vi.mocked(OtelExporter);

    new ArthurExporter({
      apiKey: 'test-api-key',
      endpoint: 'https://app.arthur.ai',
    });

    expect(otelExporterSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: {
          custom: {
            endpoint: 'https://app.arthur.ai/api/v1/traces',
            headers: {
              Authorization: 'Bearer test-api-key',
            },
            protocol: 'http/protobuf',
          },
        },
      }),
    );
  });

  it('appends /api/v1/traces to the endpoint', async () => {
    const { OtelExporter } = await import('@mastra/otel-exporter');
    const otelExporterSpy = vi.mocked(OtelExporter);

    new ArthurExporter({
      apiKey: 'test-api-key',
      endpoint: 'https://app.arthur.ai/',
    });

    expect(otelExporterSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: {
          custom: {
            endpoint: 'https://app.arthur.ai/api/v1/traces',
            headers: expect.objectContaining({
              Authorization: 'Bearer test-api-key',
            }),
            protocol: 'http/protobuf',
          },
        },
      }),
    );
  });

  it('reads apiKey from ARTHUR_API_KEY env var', async () => {
    const { OtelExporter } = await import('@mastra/otel-exporter');
    const otelExporterSpy = vi.mocked(OtelExporter);

    process.env.ARTHUR_API_KEY = 'env-api-key';
    process.env.ARTHUR_BASE_URL = 'https://env.arthur.ai';

    new ArthurExporter();

    expect(otelExporterSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: {
          custom: {
            endpoint: 'https://env.arthur.ai/api/v1/traces',
            headers: {
              Authorization: 'Bearer env-api-key',
            },
            protocol: 'http/protobuf',
          },
        },
      }),
    );
  });

  it('prefers explicit config over env vars', async () => {
    const { OtelExporter } = await import('@mastra/otel-exporter');
    const otelExporterSpy = vi.mocked(OtelExporter);

    process.env.ARTHUR_API_KEY = 'env-api-key';
    process.env.ARTHUR_BASE_URL = 'https://env.arthur.ai';

    new ArthurExporter({
      apiKey: 'explicit-key',
      endpoint: 'https://explicit.arthur.ai',
    });

    expect(otelExporterSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: {
          custom: {
            endpoint: 'https://explicit.arthur.ai/api/v1/traces',
            headers: {
              Authorization: 'Bearer explicit-key',
            },
            protocol: 'http/protobuf',
          },
        },
      }),
    );
  });

  it('merges custom headers with auth header', async () => {
    const { OtelExporter } = await import('@mastra/otel-exporter');
    const otelExporterSpy = vi.mocked(OtelExporter);

    new ArthurExporter({
      apiKey: 'test-api-key',
      endpoint: 'https://app.arthur.ai',
      headers: {
        'x-custom-header': 'value',
      },
    });

    expect(otelExporterSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: {
          custom: {
            endpoint: 'https://app.arthur.ai/api/v1/traces',
            headers: {
              'x-custom-header': 'value',
              Authorization: 'Bearer test-api-key',
            },
            protocol: 'http/protobuf',
          },
        },
      }),
    );
  });

  it('passes resource attributes through', async () => {
    const { OtelExporter } = await import('@mastra/otel-exporter');
    const otelExporterSpy = vi.mocked(OtelExporter);

    new ArthurExporter({
      apiKey: 'test-api-key',
      endpoint: 'https://app.arthur.ai',
      resourceAttributes: {
        'service.name': 'my-agent',
      },
    });

    expect(otelExporterSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceAttributes: {
          'service.name': 'my-agent',
        },
      }),
    );
  });

  it('disables exporter when apiKey is missing', () => {
    const exporter = new ArthurExporter({
      endpoint: 'https://app.arthur.ai',
    });

    // The exporter should have called setDisabled
    expect((exporter as any).setDisabled).toHaveBeenCalledWith(expect.stringContaining('API key is required'));
  });

  it('disables exporter when endpoint is missing', () => {
    const exporter = new ArthurExporter({
      apiKey: 'test-api-key',
    });

    expect((exporter as any).setDisabled).toHaveBeenCalledWith(expect.stringContaining('Endpoint is required'));
  });

  it('warns when neither taskId nor serviceName is provided', () => {
    const exporter = new ArthurExporter({
      apiKey: 'test-api-key',
      endpoint: 'https://app.arthur.ai',
    });

    exporter.init({ config: {} } as any);

    expect((exporter as any).logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Neither taskId nor serviceName is set'),
    );
  });

  it('warns when both taskId and serviceName are provided', () => {
    const exporter = new ArthurExporter({
      apiKey: 'test-api-key',
      endpoint: 'https://app.arthur.ai',
      taskId: 'test-task-id',
    });

    exporter.init({ config: { serviceName: 'my-service' } } as any);

    expect((exporter as any).logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Both taskId and serviceName are set'),
    );
  });

  it('does not warn when only taskId is provided', () => {
    const exporter = new ArthurExporter({
      apiKey: 'test-api-key',
      endpoint: 'https://app.arthur.ai',
      taskId: 'test-task-id',
    });

    exporter.init({ config: {} } as any);

    expect((exporter as any).logger.warn).not.toHaveBeenCalled();
  });

  it('does not warn when only serviceName is provided', () => {
    const exporter = new ArthurExporter({
      apiKey: 'test-api-key',
      endpoint: 'https://app.arthur.ai',
    });

    exporter.init({ config: { serviceName: 'my-service' } } as any);

    expect((exporter as any).logger.warn).not.toHaveBeenCalled();
  });

  it('reads taskId from ARTHUR_TASK_ID env var', () => {
    process.env.ARTHUR_TASK_ID = 'env-task-id';

    const exporter = new ArthurExporter({
      apiKey: 'test-api-key',
      endpoint: 'https://app.arthur.ai',
    });

    exporter.init({ config: {} } as any);

    expect((exporter as any).logger.warn).not.toHaveBeenCalled();
  });

  it('sets arthur.task.id resource attribute when taskId is provided', async () => {
    const { OtelExporter } = await import('@mastra/otel-exporter');
    const otelExporterSpy = vi.mocked(OtelExporter);

    new ArthurExporter({
      apiKey: 'test-api-key',
      endpoint: 'https://app.arthur.ai',
      taskId: 'my-task-123',
    });

    expect(otelExporterSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceAttributes: {
          'arthur.task.id': 'my-task-123',
        },
      }),
    );
  });

  it('does not set arthur.task.id when taskId is absent', async () => {
    const { OtelExporter } = await import('@mastra/otel-exporter');
    const otelExporterSpy = vi.mocked(OtelExporter);

    new ArthurExporter({
      apiKey: 'test-api-key',
      endpoint: 'https://app.arthur.ai',
    });

    const call = otelExporterSpy.mock.calls[0]?.[0] as any;
    expect(call.resourceAttributes).not.toHaveProperty('arthur.task.id');
  });
});
