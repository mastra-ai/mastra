import { randomUUID } from 'node:crypto';
import { ConsoleLogger } from '@mastra/core/logger';
import type { AnyExportedSpan, AnySpan, SpanOutputProcessor } from '@mastra/core/observability';
import { MastraStorageExporter, Observability } from '@mastra/observability';
import { z } from 'zod';

const diagnosticSchema = z.strictObject({
  code: z.enum(['intake.accepted', 'intake.rejected', 'intake.dispatched', 'intake.retry', 'telemetry.degraded']),
  runId: z.uuid().optional(),
});

/** Keep only application-owned correlation; never persist arbitrary context or content. */
function redactContent(span: AnySpan | AnyExportedSpan) {
  const runId = z.uuid().safeParse(span.metadata?.runId);
  span.name = `lead-intake.${span.type}`;
  span.entityId = 'lead-intake';
  span.entityName = 'Lead intake';
  span.input = undefined;
  span.output = undefined;
  span.attributes = undefined;
  span.metadata = runId.success ? { runId: runId.data } : {};
  span.requestContext = undefined;
  span.errorInfo = span.errorInfo ? { message: 'Workflow operation failed', name: 'IntakeError' } : undefined;
  span.inputPreview = undefined;
  span.outputPreview = undefined;
  span.errorPreview = undefined;
  span.tags = undefined;
  span.links = undefined;
}

export function safeSpan(span: AnyExportedSpan): AnyExportedSpan {
  const safe = { ...span };
  redactContent(safe);
  return safe;
}

const contentFilter: SpanOutputProcessor = {
  name: 'intake-content-filter',
  process(span) {
    if (span) redactContent(span);
    return span;
  },
  async shutdown() {},
};

export function createTelemetry() {
  let degraded = false;
  // Framework messages can contain caller input or external errors. Disable their persistence.
  const logger = new ConsoleLogger({
    name: 'lead-intake',
    level: 'debug',
    filter: context => {
      if (context.level === 'error' || context.level === 'warn') degraded = true;
      return false;
    },
  });
  const exporter = new MastraStorageExporter({
    customSpanFormatter: safeSpan,
    maxBatchWaitMs: 100,
    maxRetries: 2,
    logger,
  });
  const observability = new Observability({
    configs: {
      default: {
        serviceName: 'lead-qualification',
        exporters: [exporter],
        spanOutputProcessors: [contentFilter],
        requestContextKeys: [],
        // Only diagnostic() below submits log records, after an allowlist schema.
        logging: { enabled: false },
      },
    },
  });
  async function diagnostic(input: z.infer<typeof diagnosticSchema>) {
    const data = diagnosticSchema.parse(input);
    try {
      await exporter.onLogEvent({
        type: 'log',
        log: { logId: randomUUID(), timestamp: new Date(), level: 'info', message: data.code, data },
      });
    } catch {
      degraded = true;
      console.warn('Lead intake telemetry is unavailable. Operational records remain authoritative.');
    }
  }
  return { logger, observability, exporter, diagnostic, isDegraded: () => degraded };
}
export type Telemetry = ReturnType<typeof createTelemetry>;
