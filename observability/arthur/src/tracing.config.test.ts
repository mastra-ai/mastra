import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ArthurExporter } from './tracing';

// Mock OtelExporter to spy on its constructor
vi.mock('@mastra/otel-exporter', () => ({
  OtelExporter: vi.fn().mockImplementation(function () {
    return {
      exportTracingEvent: vi.fn(),
      shutdown: vi.fn(),
      setDisabled: vi.fn(),
    };
  }),
}));

describe('ArthurExporterConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clean env vars between tests
    delete process.env.ARTHUR_API_KEY;
    delete process.env.ARTHUR_BASE_URL;
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
    expect((exporter as any).setDisabled).toHaveBeenCalledWith(
      expect.stringContaining('API key is required'),
    );
  });

  it('disables exporter when endpoint is missing', () => {
    const exporter = new ArthurExporter({
      apiKey: 'test-api-key',
    });

    expect((exporter as any).setDisabled).toHaveBeenCalledWith(
      expect.stringContaining('Endpoint is required'),
    );
  });
});
