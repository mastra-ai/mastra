import type { Mastra } from '../mastra';
import type { MetricEvent, ObservabilityExporter } from '../observability';
import { getServerTelemetryBaseContext, getServerTelemetryContext, hashProjectIdentity } from './context';
import { captureTelemetryEventImmediate, isTelemetryEnabled } from './posthog';

const INPUT_TOKENS_METRIC = 'mastra_model_total_input_tokens';
const OUTPUT_TOKENS_METRIC = 'mastra_model_total_output_tokens';
const DEFAULT_REPORT_INTERVAL_MS = 15 * 60 * 1000;
// Kept well inside the 5s `mastra dev` gives a reloading server before SIGKILL.
const DEFAULT_SHUTDOWN_TIMEOUT_MS = 2000;

export const MODEL_USAGE_TELEMETRY_EVENT = 'mastra_model_token_usage_v2';

export interface StartModelUsageTelemetryOptions {
  /** How often accumulated usage is reported. Defaults to 15 minutes. */
  reportIntervalMs?: number;
  /** How long shutdown waits for the final report to be delivered. Defaults to 2 seconds. */
  shutdownTimeoutMs?: number;
}

export interface StartServerlessModelUsageTelemetryOptions {
  /** The serverless platform the server runs on, sent with each report (for example `vercel`). */
  runtime: string;
  /**
   * A value that identifies the deployed project on that platform, such as its project ID.
   * Only a hash of it is sent, as `project_id2`.
   */
  projectKey?: string;
}

export interface ModelUsageReporter {
  /** Reports the usage counted since the previous report. Resolves once sent; never rejects. */
  report(): Promise<void>;
}

type ReportReason = 'interval' | 'shutdown' | 'request';

interface ServerlessReporting {
  runtime: string;
  projectId2: string | undefined;
}

interface MeterOptions extends StartModelUsageTelemetryOptions {
  /** Set for serverless servers, which report per request instead of on a timer. */
  serverless?: ServerlessReporting;
}

interface ModelUsage {
  provider: string | null;
  model: string | null;
  inputTokens: number;
  outputTokens: number;
}

const startedFor = new WeakSet<Mastra>();

/**
 * Counts model tokens from the observability bus as model calls finish, and reports
 * the counts accumulated since the previous report. Every token is reported once, by
 * the process that used it, so redeploys, replicas, and storage resets can't repeat
 * or drop usage.
 */
class ModelUsageMeter implements ObservabilityExporter {
  readonly name = 'mastra-model-usage-telemetry';

  #usage = new Map<string, ModelUsage>();
  #windowStart = new Date();
  #pendingReports = new Set<Promise<void>>();
  #timer: ReturnType<typeof setInterval> | undefined;
  #shutdownTimeoutMs: number;
  #serverless: ServerlessReporting | undefined;

  constructor(options: MeterOptions) {
    this.#shutdownTimeoutMs = options.shutdownTimeoutMs ?? DEFAULT_SHUTDOWN_TIMEOUT_MS;
    this.#serverless = options.serverless;
    if (!this.#serverless) {
      this.#timer = setInterval(
        () => void this.report('interval'),
        options.reportIntervalMs ?? DEFAULT_REPORT_INTERVAL_MS,
      );
      this.#timer.unref?.();
    }
  }

  onMetricEvent({ metric }: MetricEvent): void {
    const field =
      metric.name === INPUT_TOKENS_METRIC
        ? 'inputTokens'
        : metric.name === OUTPUT_TOKENS_METRIC
          ? 'outputTokens'
          : undefined;
    if (!field || !(metric.value > 0)) {
      return;
    }

    const provider = metric.costContext?.provider ?? null;
    const model = metric.costContext?.model ?? null;
    const key = `${provider}\u0000${model}`;
    let usage = this.#usage.get(key);
    if (!usage) {
      usage = { provider, model, inputTokens: 0, outputTokens: 0 };
      this.#usage.set(key, usage);
    }
    usage[field] += metric.value;
  }

  // A synchronous no-op, so the bus doesn't create (and track) a promise per span event
  // as it would by falling back to exportTracingEvent.
  onTracingEvent(): void {}

  async exportTracingEvent(): Promise<void> {}

  // Observability flushes are frequent in serverless and durable runtimes; reporting on
  // each one would split usage into many tiny events, so only the interval, request, and
  // shutdown report.
  async flush(): Promise<void> {}

  async shutdown(): Promise<void> {
    clearInterval(this.#timer);
    // Awaited below through #pendingReports, bounded by the shutdown timeout.
    void this.report('shutdown');

    let timeout: ReturnType<typeof setTimeout> | undefined;
    await Promise.race([
      Promise.all(this.#pendingReports),
      new Promise<void>(resolve => {
        timeout = setTimeout(resolve, this.#shutdownTimeoutMs);
      }),
    ]);
    clearTimeout(timeout);
  }

  /** Takes the usage counted so far and sends it; the returned promise settles once sent. */
  report(reason: ReportReason): Promise<void> {
    if (this.#usage.size === 0) {
      return Promise.resolve();
    }

    const rows = [...this.#usage.values()];
    const windowStart = this.#windowStart;
    const windowEnd = new Date();
    this.#usage = new Map();
    this.#windowStart = windowEnd;

    const report = sendReport(rows, windowStart, windowEnd, reason, this.#serverless).finally(() => {
      this.#pendingReports.delete(report);
    });
    this.#pendingReports.add(report);
    return report;
  }
}

async function sendReport(
  rows: ModelUsage[],
  windowStart: Date,
  windowEnd: Date,
  reason: ReportReason,
  serverless: ServerlessReporting | undefined,
): Promise<void> {
  try {
    // Serverless servers have no Git checkout and are never Platform projects, so they
    // take their project identity from the platform instead of looking it up.
    const { projectId, projectId2, distinctId, command, nodeEnv } = serverless
      ? { ...getServerTelemetryBaseContext(), projectId2: serverless.projectId2 }
      : await getServerTelemetryContext();
    await Promise.all(
      rows.map(row =>
        captureTelemetryEventImmediate(MODEL_USAGE_TELEMETRY_EVENT, distinctId, {
          provider: row.provider,
          model: row.model,
          input_tokens: row.inputTokens,
          output_tokens: row.outputTokens,
          command,
          node_env: nodeEnv,
          project_id: projectId,
          ...(projectId2 ? { project_id2: projectId2 } : {}),
          window_start: windowStart.toISOString(),
          window_end: windowEnd.toISOString(),
          report_reason: reason,
          ...(serverless ? { runtime: serverless.runtime } : {}),
        }),
      ),
    );
  } catch {
    // Usage telemetry must never affect server runtime or shutdown.
  }
}

function startMeter(mastra: Mastra, options: MeterOptions): ModelUsageMeter | undefined {
  if (!isTelemetryEnabled() || startedFor.has(mastra)) {
    return undefined;
  }

  const instances = [...mastra.observability.listInstances().values()].filter(
    instance => typeof instance.registerExporter === 'function',
  );
  if (instances.length === 0) {
    return undefined;
  }

  startedFor.add(mastra);
  const meter = new ModelUsageMeter(options);
  for (const instance of instances) {
    instance.registerExporter!(meter);
  }
  return meter;
}

/**
 * Starts reporting model token usage for this server process to Mastra's project-linked
 * telemetry. Usage is read from the observability metrics bus, so it is only counted when
 * observability is configured. Reports go out every 15 minutes when there is new usage,
 * and once more when Mastra shuts down. Respects `MASTRA_TELEMETRY_DISABLED`. Never throws.
 */
export function startModelUsageTelemetry(mastra: Mastra, options: StartModelUsageTelemetryOptions = {}): void {
  try {
    startMeter(mastra, options);
  } catch {
    // Usage telemetry must never affect server startup.
  }
}

/**
 * Starts counting model token usage for a serverless server, which reports per request
 * instead of on a timer: call `report()` once a request has finished, and keep the
 * function alive until it resolves. Returns `undefined` when telemetry is disabled, when
 * observability isn't configured, or when usage is already being counted. Never throws.
 */
export function startServerlessModelUsageTelemetry(
  mastra: Mastra,
  options: StartServerlessModelUsageTelemetryOptions,
): ModelUsageReporter | undefined {
  try {
    const projectKey = options.projectKey?.trim();
    const meter = startMeter(mastra, {
      serverless: {
        runtime: options.runtime,
        projectId2: projectKey ? hashProjectIdentity(projectKey) : undefined,
      },
    });
    return meter ? { report: () => meter.report('request') } : undefined;
  } catch {
    return undefined;
  }
}
