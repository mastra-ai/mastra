import type { InitExporterOptions } from '@mastra/core/observability';
import { OtelExporter } from '@mastra/otel-exporter';
import type { OtelExporterConfig } from '@mastra/otel-exporter';

import { OpenInferenceOTLPTraceExporter } from './openInferenceOTLPExporter.js';

const LOG_PREFIX = '[ArthurExporter]';

export type ArthurExporterConfig = Omit<OtelExporterConfig, 'provider' | 'exporter'> & {
  /**
   * Arthur API key for authentication.
   * Falls back to ARTHUR_API_KEY environment variable.
   */
  apiKey?: string;
  /**
   * Arthur platform endpoint (e.g. https://app.arthur.ai).
   * Falls back to ARTHUR_BASE_URL environment variable.
   */
  endpoint?: string;
  /**
   * Arthur task ID to associate traces with.
   * Falls back to ARTHUR_TASK_ID environment variable.
   * At least one of taskId or serviceName (from the observability config) should be provided.
   */
  taskId?: string;
  /**
   * Optional headers to be added to each OTLP request.
   * Note: the Authorization header is managed internally when apiKey is provided.
   */
  headers?: Record<string, string>;
};

/**
 * Exports Mastra traces to Arthur AI using OpenInference semantic conventions.
 *
 * Supports zero-config setup via environment variables (ARTHUR_API_KEY, ARTHUR_BASE_URL,
 * ARTHUR_TASK_ID) or explicit configuration. Automatically disables itself with a warning
 * when required credentials are missing.
 *
 * @example
 * ```ts
 * const mastra = new Mastra({
 *   observability: new Observability({
 *     configs: {
 *       arthur: {
 *         serviceName: 'my-service',
 *         exporters: [new ArthurExporter()],
 *       },
 *     },
 *   }),
 * });
 * ```
 */
export class ArthurExporter extends OtelExporter {
  name = 'arthur';
  private taskId?: string;

  /**
   * @param config - Arthur exporter configuration. All fields are optional when
   * the corresponding environment variables are set.
   */
  constructor(config: ArthurExporterConfig = {}) {
    const apiKey = config.apiKey ?? process.env.ARTHUR_API_KEY;
    const endpoint = config.endpoint ?? process.env.ARTHUR_BASE_URL;
    const taskId = config.taskId ?? process.env.ARTHUR_TASK_ID;

    const headers: Record<string, string> = {
      ...config.headers,
    };

    let disabledReason: string | undefined;

    if (!apiKey) {
      disabledReason =
        `${LOG_PREFIX} API key is required. ` + `Set ARTHUR_API_KEY environment variable or pass apiKey in config.`;
    } else {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    if (!disabledReason && !endpoint) {
      disabledReason =
        `${LOG_PREFIX} Endpoint is required. ` + `Set ARTHUR_BASE_URL environment variable or pass endpoint in config.`;
    }

    // Ensure the endpoint ends with /api/v1/traces
    const tracesEndpoint = endpoint ? `${stripTrailingSlashes(endpoint)}/api/v1/traces` : 'http://disabled';

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
      exporter: new OpenInferenceOTLPTraceExporter({
        url: tracesEndpoint,
        headers,
      }),
      ...config,
      resourceAttributes: {
        ...(taskId ? { 'arthur.task.id': taskId } : {}),
        ...config.resourceAttributes,
      },
      provider: {
        custom: {
          endpoint: tracesEndpoint,
          headers,
          protocol: 'http/protobuf',
        },
      } satisfies OtelExporterConfig['provider'],
    } satisfies OtelExporterConfig);

    this.taskId = taskId;
  }

  /**
   * Called after construction with the observability config.
   * Validates that traces can be routed to a task via either taskId or serviceName.
   */
  init(options: InitExporterOptions) {
    super.init(options);

    const serviceName = options.config?.serviceName;

    if (this.taskId && serviceName) {
      this.logger.warn(
        `${LOG_PREFIX} Both taskId and serviceName are set. Arthur Engine will use serviceName to route traces, ` +
          `ignoring the provided taskId.`,
      );
    } else if (!this.taskId && !serviceName) {
      this.logger.warn(
        `${LOG_PREFIX} Neither taskId nor serviceName is set. Set ARTHUR_TASK_ID environment variable, ` +
          `pass taskId in config, or set serviceName in the observability config so Arthur Engine can route traces to a task.`,
      );
    }
  }
}

/**
 * Remove trailing '/' characters procedurally. Avoids the polynomial
 * backtracking that a greedy regex like `/\/+$/` can exhibit when the
 * input is attacker-controlled.
 */
function stripTrailingSlashes(s: string): string {
  let end = s.length;
  while (end > 0 && s.charCodeAt(end - 1) === 47 /* '/' */) {
    end--;
  }
  return end === s.length ? s : s.slice(0, end);
}
