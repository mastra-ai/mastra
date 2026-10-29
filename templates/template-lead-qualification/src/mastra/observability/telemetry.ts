import { createHash, randomUUID } from 'node:crypto';
import { ConsoleLogger } from '@mastra/core/logger';
import { SpanType } from '@mastra/core/observability';
import type { AnyExportedSpan, AnySpan, SpanOutputProcessor } from '@mastra/core/observability';
import { MastraStorageExporter, Observability } from '@mastra/observability';
import { z } from 'zod';

export const pricingSchema = z.strictObject({
  version: z.string().regex(/^[a-zA-Z0-9._:-]{1,80}$/),
  model: z.string().regex(/^[a-zA-Z0-9/._:-]{1,120}$/),
  inputPerMillion: z.number().nonnegative().finite(),
  outputPerMillion: z.number().nonnegative().finite(),
  assumption: z.literal('standard_uncached_text_tokens_only'),
});
export const researchMeasurementSchema = z.strictObject({
  usageId: z.uuid(),
  runId: z.uuid(),
  stage: z.enum(['search', 'extract', 'verify']),
  durationMs: z.number().nonnegative().finite(),
  inputTokens: z.number().int().nonnegative().nullable(),
  outputTokens: z.number().int().nonnegative().nullable(),
  reasoningTokens: z.number().int().nonnegative().nullable(),
  model: z.string().regex(/^[a-zA-Z0-9/._:-]{1,120}$/),
});
const correlationSchema = z.object({
  runId: z.uuid().optional(),
  assessmentId: z.uuid().optional(),
  reviewId: z.uuid().optional(),
  classification: z.enum(['qualified', 'nurture', 'disqualified', 'needs_review']).optional(),
  score: z.number().int().min(0).max(100).optional(),
  policyVersion: z
    .string()
    .regex(/^[a-zA-Z0-9._:-]{1,80}$/)
    .optional(),
});
const diagnosticSchema = z.strictObject({
  code: z.enum([
    'intake.accepted',
    'intake.rejected',
    'intake.dispatched',
    'intake.retry',
    'telemetry.degraded',
    'research.identity',
    'research.retrieval',
    'research.facts',
    'qualification.scored',
    'review.prepared',
    'output.applied',
  ]),
  ...correlationSchema.shape,
});

/** Keep only application-owned correlation; never persist arbitrary context or content. */
function redactContent(span: AnySpan | AnyExportedSpan) {
  const correlation = correlationSchema.safeParse(span.metadata ?? {});
  span.name = `lead-intake.${span.type}`;
  span.entityId = 'lead-intake';
  span.entityName = 'Lead intake';
  span.input = undefined;
  span.output = undefined;
  span.attributes = undefined;
  span.metadata = correlation.success ? correlation.data : {};
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

export function createTelemetry(pricing?: z.infer<typeof pricingSchema>) {
  const rates = pricing === undefined ? undefined : pricingSchema.parse(pricing);
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
    const parsed = diagnosticSchema.safeParse(input);
    if (!parsed.success) {
      degraded = true;
      return;
    }
    const data = parsed.data;
    try {
      const span = observability
        .getDefaultInstance()
        ?.startSpan({ type: SpanType.GENERIC, name: data.code, metadata: correlationSchema.parse(data) });
      span?.end();
      await exporter.onLogEvent({
        type: 'log',
        log: { logId: randomUUID(), timestamp: new Date(), level: 'info', message: data.code, data },
      });
    } catch {
      degraded = true;
      console.warn('Lead intake telemetry is unavailable. Operational records remain authoritative.');
    }
  }
  async function research(input: z.infer<typeof researchMeasurementSchema>) {
    const parsed = researchMeasurementSchema.safeParse(input);
    if (!parsed.success) {
      degraded = true;
      return;
    }
    const data = parsed.data;
    const estimate =
      rates &&
      rates.model === data.model &&
      data.inputTokens !== null &&
      data.inputTokens <= 272000 &&
      data.outputTokens !== null
        ? (data.inputTokens * rates.inputPerMillion + data.outputTokens * rates.outputPerMillion) / 1_000_000
        : null;
    const cost = {
      pricingVersion: rates?.version ?? null,
      estimate,
      scope: 'text_tokens_only',
      assumption: rates?.assumption ?? null,
      status: estimate === null ? 'unavailable' : 'partial_excludes_search_and_other_charges',
    };
    try {
      await exporter.onLogEvent({
        type: 'log',
        log: {
          logId: randomUUID(),
          timestamp: new Date(),
          level: 'info',
          message: 'research.measurement',
          data: { ...data, cost },
        },
      });
      const values = {
        duration_ms: data.durationMs,
        input_tokens: data.inputTokens,
        output_tokens: data.outputTokens,
        reasoning_tokens: data.reasoningTokens,
      };
      for (const [name, value] of Object.entries(values))
        if (value !== null)
          await exporter.onMetricEvent({
            type: 'metric',
            metric: {
              metricId: createHash('sha256').update(`${data.usageId}:${name}`).digest('hex'),
              usageId: data.usageId,
              timestamp: new Date(),
              name: `lead_research_${name}`,
              value,
              labels: { stage: data.stage, model: data.model },
              metadata: { runId: data.runId, pricingVersion: rates?.version ?? null, costStatus: cost.status },
              costContext: {
                provider: 'openai',
                model: data.model,
                ...(name === 'output_tokens' && estimate !== null ? { estimatedCost: estimate, costUnit: 'USD' } : {}),
                costMetadata: cost,
              },
            },
          });
    } catch {
      degraded = true;
      console.warn('Lead intake telemetry is unavailable. Operational records remain authoritative.');
    }
  }
  return { logger, observability, exporter, diagnostic, research, isDegraded: () => degraded };
}
export type Telemetry = ReturnType<typeof createTelemetry>;
