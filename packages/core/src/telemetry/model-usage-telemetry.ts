import type { Mastra } from '../mastra';
import type { MetricEvent, ObservabilityExporter } from '../observability';
import { getServerTelemetryContext } from './context';
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

type ReportReason = 'interval' | 'shutdown';

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
  #timer: ReturnType<typeof setInterval>;
  #shutdownTimeoutMs: number;

  constructor(options: StartModelUsageTelemetryOptions) {
    this.#shutdownTimeoutMs = options.shutdownTimeoutMs ?? DEFAULT_SHUTDOWN_TIMEOUT_MS;
    this.#timer = setInterval(() => this.#report('interval'), options.reportIntervalMs ?? DEFAULT_REPORT_INTERVAL_MS);
    this.#timer.unref?.();
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
  // each one would split usage into many tiny events, so only the interval and shutdown report.
  async flush(): Promise<void> {}

  async shutdown(): Promise<void> {
    clearInterval(this.#timer);
    this.#report('shutdown');

    let timeout: ReturnType<typeof setTimeout> | undefined;
    await Promise.race([
      Promise.all(this.#pendingReports),
      new Promise<void>(resolve => {
        timeout = setTimeout(resolve, this.#shutdownTimeoutMs);
      }),
    ]);
    clearTimeout(timeout);
  }

  #report(reason: ReportReason): void {
    if (this.#usage.size === 0) {
      return;
    }

    const rows = [...this.#usage.values()];
    const windowStart = this.#windowStart;
    const windowEnd = new Date();
    this.#usage = new Map();
    this.#windowStart = windowEnd;

    const report = sendReport(rows, windowStart, windowEnd, reason).finally(() => {
      this.#pendingReports.delete(report);
    });
    this.#pendingReports.add(report);
  }
}

async function sendReport(rows: ModelUsage[], windowStart: Date, windowEnd: Date, reason: ReportReason): Promise<void> {
  try {
    const { projectId, projectId2, distinctId, command, nodeEnv } = await getServerTelemetryContext();
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
        }),
      ),
    );
  } catch {
    // Usage telemetry must never affect server runtime or shutdown.
  }
}

/**
 * Starts reporting model token usage for this server process to Mastra's project-linked
 * telemetry. Usage is read from the observability metrics bus, so it is only counted when
 * observability is configured. Reports go out every 15 minutes when there is new usage,
 * and once more when Mastra shuts down. Respects `MASTRA_TELEMETRY_DISABLED`. Never throws.
 */
export function startModelUsageTelemetry(mastra: Mastra, options: StartModelUsageTelemetryOptions = {}): void {
  try {
    if (!isTelemetryEnabled() || startedFor.has(mastra)) {
      return;
    }

    const instances = [...mastra.observability.listInstances().values()].filter(
      instance => typeof instance.registerExporter === 'function',
    );
    if (instances.length === 0) {
      return;
    }

    startedFor.add(mastra);
    const meter = new ModelUsageMeter(options);
    for (const instance of instances) {
      instance.registerExporter!(meter);
    }
  } catch {
    // Usage telemetry must never affect server startup.
  }
}
