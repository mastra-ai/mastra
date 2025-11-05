import { describe, expect, it, vi } from 'vitest';
import { ARIZE_AX_ENDPOINT, ArizeExporter } from './tracing';

// Mock OtelExporter to spy on its constructor
vi.mock('@mastra/otel-exporter', () => ({
  OtelExporter: vi.fn().mockImplementation(() => ({
    exportTracingEvent: vi.fn(),
    shutdown: vi.fn(),
  })),
}));

describe('ArizeExporterConfig', () => {
  it('uses ARIZE_AX_ENDPOINT as fallback when spaceId is provided but no endpoint', async () => {
    const { OtelExporter } = await import('@mastra/otel-exporter');
    const otelExporterSpy = vi.mocked(OtelExporter);

    new ArizeExporter({
      spaceId: 'test-space-id',
      apiKey: 'test-api-key',
      projectName: 'test-project',
    });

    // Verify OtelExporter was called with the correct config
    expect(otelExporterSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: {
          custom: {
            endpoint: ARIZE_AX_ENDPOINT,
            headers: {
              space_id: 'test-space-id',
              api_key: 'test-api-key',
            },
            protocol: 'http/protobuf',
          },
        },
        resourceAttributes: {
          'openinference.project.name': 'test-project',
        },
      }),
    );
  });
  it('uses the provided endpoint when provided', async () => {
    const { OtelExporter } = await import('@mastra/otel-exporter');
    const otelExporterSpy = vi.mocked(OtelExporter);

    new ArizeExporter({
      endpoint: 'https://test-endpoint.com/v1/traces',
      spaceId: 'test-space-id',
      apiKey: 'test-api-key',
    });

    expect(otelExporterSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: 'https://test-endpoint.com/v1/traces',
        spaceId: 'test-space-id',
        apiKey: 'test-api-key',
      }),
    );
  });
  it('merges headers when provided', async () => {
    const { OtelExporter } = await import('@mastra/otel-exporter');
    const otelExporterSpy = vi.mocked(OtelExporter);

    new ArizeExporter({
      endpoint: 'https://test-endpoint.com/v1/traces',
      spaceId: 'test-space-id',
      apiKey: 'test-api-key',
      headers: {
        'x-custom-header': 'value',
      },
    });

    expect(otelExporterSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: {
          'x-custom-header': 'value',
        },
      }),
    );
  });
  it('merges resource attributes when provided', async () => {
    const { OtelExporter } = await import('@mastra/otel-exporter');
    const otelExporterSpy = vi.mocked(OtelExporter);

    new ArizeExporter({
      endpoint: 'https://test-endpoint.com/v1/traces',
      spaceId: 'test-space-id',
      apiKey: 'test-api-key',
      projectName: 'test-project',
      resourceAttributes: {
        'custom.attribute': 'value',
      },
    });

    expect(otelExporterSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceAttributes: {
          'openinference.project.name': 'test-project',
          'custom.attribute': 'value',
        },
      }),
    );
  });
});
