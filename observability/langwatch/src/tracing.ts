import { OtelExporter } from '@mastra/otel-exporter';
import type { OtelExporterConfig } from '@mastra/otel-exporter';

const LOG_PREFIX = '[LangwatchExporter]';

export const LANGWATCH_ENDPOINT = 'https://app.langwatch.ai/api/otel/v1/traces';

export type LangwatchExporterConfig = Omit<OtelExporterConfig, 'provider'> & {
  /**
   * LangWatch API key. Defaults to `process.env.LANGWATCH_API_KEY`.
   */
  apiKey?: string;
  /**
   * LangWatch OTLP endpoint. Defaults to `https://app.langwatch.ai/api/otel/v1/traces`.
   * Override this if you are using a self-hosted LangWatch instance.
   */
  endpoint?: string;
};

export class LangwatchExporter extends OtelExporter {
  name = 'langwatch';

  constructor(config: LangwatchExporterConfig = {}) {
    const apiKey = config.apiKey ?? process.env.LANGWATCH_API_KEY;
    const endpoint = config.endpoint ?? process.env.LANGWATCH_ENDPOINT ?? LANGWATCH_ENDPOINT;

    const headers: Record<string, string> = {};

    let disabledReason: string | undefined;

    if (!apiKey) {
      disabledReason =
        `${LOG_PREFIX} API key is required. ` +
        `Set LANGWATCH_API_KEY environment variable or pass apiKey in config.`;
    } else {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    if (disabledReason) {
      super({
        ...config,
        provider: {
          custom: {
            endpoint: 'http://disabled',
            headers: {},
            protocol: 'http/protobuf',
          },
        },
      });
      this.setDisabled(disabledReason);
      return;
    }

    super({
      ...config,
      provider: {
        custom: {
          endpoint,
          headers,
          protocol: 'http/protobuf',
        },
      } satisfies OtelExporterConfig['provider'],
    } satisfies OtelExporterConfig);
  }
}
