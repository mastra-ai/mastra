import { describe, expect, it, vi } from 'vitest';
import { LANGWATCH_ENDPOINT, LangwatchExporter } from './tracing';

vi.mock('@mastra/otel-exporter', () => ({
  OtelExporter: vi.fn().mockImplementation(function (this: any) {
    this.isDisabled = false;
    this.setDisabled = vi.fn().mockImplementation((reason: string) => {
      this.isDisabled = true;
    });
    this.exportTracingEvent = vi.fn();
    this.shutdown = vi.fn();
  }),
}));

describe('LangwatchExporterConfig', () => {
  it('uses default endpoint when only apiKey is provided', async () => {
    const { OtelExporter } = await import('@mastra/otel-exporter');
    const otelExporterSpy = vi.mocked(OtelExporter);

    new LangwatchExporter({
      apiKey: 'lw_test_key',
    });

    expect(otelExporterSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: {
          custom: {
            endpoint: LANGWATCH_ENDPOINT,
            headers: {
              Authorization: 'Bearer lw_test_key',
            },
            protocol: 'http/protobuf',
          },
        },
      }),
    );
  });

  it('uses custom endpoint when provided', async () => {
    const { OtelExporter } = await import('@mastra/otel-exporter');
    const otelExporterSpy = vi.mocked(OtelExporter);

    new LangwatchExporter({
      apiKey: 'lw_test_key',
      endpoint: 'https://self-hosted.example.com/api/otel/v1/traces',
    });

    expect(otelExporterSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: {
          custom: {
            endpoint: 'https://self-hosted.example.com/api/otel/v1/traces',
            headers: {
              Authorization: 'Bearer lw_test_key',
            },
            protocol: 'http/protobuf',
          },
        },
      }),
    );
  });

  it('disables when no API key is provided', () => {
    const exporter = new LangwatchExporter();
    expect(exporter.isDisabled).toBe(true);
  });

  it('uses LANGWATCH_API_KEY env var when no config apiKey', async () => {
    const { OtelExporter } = await import('@mastra/otel-exporter');
    const otelExporterSpy = vi.mocked(OtelExporter);

    const originalEnv = process.env.LANGWATCH_API_KEY;
    process.env.LANGWATCH_API_KEY = 'lw_env_key';

    try {
      new LangwatchExporter();

      expect(otelExporterSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: {
            custom: {
              endpoint: LANGWATCH_ENDPOINT,
              headers: {
                Authorization: 'Bearer lw_env_key',
              },
              protocol: 'http/protobuf',
            },
          },
        }),
      );
    } finally {
      if (originalEnv === undefined) {
        delete process.env.LANGWATCH_API_KEY;
      } else {
        process.env.LANGWATCH_API_KEY = originalEnv;
      }
    }
  });

  it('uses LANGWATCH_ENDPOINT env var for custom endpoint', async () => {
    const { OtelExporter } = await import('@mastra/otel-exporter');
    const otelExporterSpy = vi.mocked(OtelExporter);

    const originalApiKey = process.env.LANGWATCH_API_KEY;
    const originalEndpoint = process.env.LANGWATCH_ENDPOINT;
    process.env.LANGWATCH_API_KEY = 'lw_env_key';
    process.env.LANGWATCH_ENDPOINT = 'https://custom.langwatch.ai/api/otel/v1/traces';

    try {
      new LangwatchExporter();

      expect(otelExporterSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: {
            custom: {
              endpoint: 'https://custom.langwatch.ai/api/otel/v1/traces',
              headers: {
                Authorization: 'Bearer lw_env_key',
              },
              protocol: 'http/protobuf',
            },
          },
        }),
      );
    } finally {
      if (originalApiKey === undefined) {
        delete process.env.LANGWATCH_API_KEY;
      } else {
        process.env.LANGWATCH_API_KEY = originalApiKey;
      }
      if (originalEndpoint === undefined) {
        delete process.env.LANGWATCH_ENDPOINT;
      } else {
        process.env.LANGWATCH_ENDPOINT = originalEndpoint;
      }
    }
  });
});
