import { randomUUID } from 'node:crypto';

import type { Client } from '@libsql/client';
import type { DuckDBInstance } from '@duckdb/node-api';
import { z } from 'zod';

import { metricsSchemaVersion } from '../contracts/http/public-api.js';
import {
  providerMetricRecordSchema,
  workflowStepMetricRecordSchema,
  type Clock,
  type ProviderMetricsRecorder,
} from '../contracts/technical/primitives.js';
import { kycCaseStatusSchema } from '../domain/case.js';
import { evalMetricsSchema, metricsSummarySchema, providerMetricsSchema } from '../server/public-schemas.js';

const minimumMetricDenominator = 5;
const maximumWindowMs = 90 * 24 * 60 * 60 * 1000;
const defaultWindowMs = 24 * 60 * 60 * 1000;
const leaseMs = 60_000;

const casePayloadSchema = z
  .object({
    kind: z.literal('case'),
    caseId: z.string().min(1).max(128),
    status: kycCaseStatusSchema,
    jurisdiction: z.string().length(2).optional(),
    policyVersion: z.string().min(1).max(64).optional(),
    caseCreatedAt: z.iso.datetime({ offset: true }).optional(),
  })
  .strict();
const legacyCasePayloadSchema = casePayloadSchema.omit({ kind: true });
const providerPayloadSchema = z
  .object({
    kind: z.literal('provider'),
    caseId: z.string().min(1).max(128).nullable(),
    providerId: z.string().min(1).max(128),
    operation: z.string().min(1).max(100),
    outcome: z.enum(['success', 'timeout', 'retry', 'error']),
    latencyMs: z.number().int().nonnegative().nullable(),
    attemptCount: z.number().int().positive(),
    retryCount: z.number().int().nonnegative(),
    inputUnits: z.number().int().nonnegative().nullable(),
    outputUnits: z.number().int().nonnegative().nullable(),
    costUsd: z.number().nonnegative().nullable(),
    priceVersion: z.string().min(1).max(100).nullable(),
  })
  .strict();
const feedbackPayloadSchema = z
  .object({
    kind: z.literal('feedback'),
    caseId: z.string().min(1).max(128),
    reviewId: z.string().min(1).max(128),
    extractionUseful: z.boolean().nullable(),
    screeningUseful: z.boolean().nullable(),
    riskUseful: z.boolean().nullable(),
    evidenceUseful: z.boolean().nullable(),
    structuredResponseCount: z.number().int().min(0).max(5),
    falsePositiveEscalation: z.boolean().nullable(),
    curatedForDataset: z.boolean(),
    turnaroundMs: z.number().int().nonnegative(),
  })
  .strict();
const evalPayloadSchema = z
  .object({
    kind: z.literal('eval'),
    evalId: z.string().min(1).max(128),
    candidateId: z.string().min(1).max(128),
    datasetVersion: z.string().min(1).max(100),
    manifestDigest: z.string().regex(/^[a-f0-9]{64}$/u),
    sourceRevision: z
      .string()
      .regex(/^[a-f0-9]{40}$/u)
      .optional(),
    sourceDigest: z
      .string()
      .regex(/^[a-f0-9]{64}$/u)
      .optional(),
    score: z.number().min(0).max(1),
    passed: z.boolean(),
  })
  .strict();
const workflowStepPayloadSchema = z
  .object({
    kind: z.literal('workflow-step'),
    caseId: z.string().min(1).max(128).nullable(),
    workflowId: z.string().min(1).max(128),
    runId: z.string().min(1).max(128),
    stepId: z.string().min(1).max(128),
    outcome: z.enum(['success', 'error']),
    durationMs: z.number().int().nonnegative(),
  })
  .strict();
const outboxPayloadSchema = z.union([
  casePayloadSchema,
  legacyCasePayloadSchema,
  providerPayloadSchema,
  feedbackPayloadSchema,
  evalPayloadSchema,
  workflowStepPayloadSchema,
]);
const outboxRowSchema = z.object({
  tenant_id: z.string().min(1),
  event_id: z.string().min(1),
  event_type: z.string().min(1),
  payload_json: z.string(),
  created_at: z.iso.datetime({ offset: true }),
});

export const metricsWindowInputSchema = z
  .object({
    from: z.iso.datetime({ offset: true }).optional(),
    to: z.iso.datetime({ offset: true }).optional(),
  })
  .strict();
export type MetricsWindowInput = z.input<typeof metricsWindowInputSchema>;

export const evalMetricInputSchema = z
  .object({
    tenantId: z.string().min(1).max(128),
    eventId: z.string().min(1).max(128),
    evalId: z.string().min(1).max(128),
    candidateId: z.string().min(1).max(128),
    datasetVersion: z.string().min(1).max(100),
    manifestDigest: z.string().regex(/^[a-f0-9]{64}$/u),
    sourceRevision: z.string().regex(/^[a-f0-9]{40}$/u),
    sourceDigest: z.string().regex(/^[a-f0-9]{64}$/u),
    score: z.number().min(0).max(1),
    passed: z.boolean(),
    occurredAt: z.iso.datetime({ offset: true }),
  })
  .strict();

const integer = (value: unknown): number => {
  if (typeof value !== 'number' && typeof value !== 'bigint') {
    throw new Error('Analytics returned a non-numeric aggregate');
  }
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0) {
    throw new Error('Analytics returned an invalid aggregate');
  }
  return number;
};

const numeric = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'number' && typeof value !== 'bigint') {
    throw new Error('Analytics returned a non-numeric value');
  }
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    throw new Error('Analytics returned an invalid value');
  }
  return number;
};

const available = (value: number | null, denominator: number): number | 'not_available' =>
  denominator < minimumMetricDenominator || value === null ? 'not_available' : value;
const currency = (value: number | null): number | null =>
  value === null ? null : Math.round(value * 1_000_000_000) / 1_000_000_000;
const rate = (numerator: number, denominator: number): number | 'not_available' =>
  denominator < minimumMetricDenominator ? 'not_available' : numerator / denominator;

const normalizePayload = (value: unknown) => {
  const payload = outboxPayloadSchema.parse(value);
  return 'kind' in payload ? payload : ({ kind: 'case', ...payload } as const);
};

export class KycMetricsService implements ProviderMetricsRecorder {
  readonly #projectorId = randomUUID();
  #projectionQueue: Promise<void> = Promise.resolve();

  constructor(
    private readonly operational: Client,
    private readonly analytics: DuckDBInstance,
    private readonly clock: Clock,
  ) {}

  resolveWindow(input: MetricsWindowInput = {}) {
    const parsed = metricsWindowInputSchema.parse(input);
    const to = parsed.to === undefined ? this.clock.now() : new Date(parsed.to);
    const from = parsed.from === undefined ? new Date(to.getTime() - defaultWindowMs) : new Date(parsed.from);
    if (to.getTime() <= from.getTime()) {
      throw new z.ZodError([{ code: 'custom', path: ['from'], message: 'from must be earlier than to' }]);
    }
    if (to.getTime() - from.getTime() > maximumWindowMs) {
      throw new z.ZodError([{ code: 'custom', path: ['from'], message: 'window cannot exceed 90 days' }]);
    }
    return { from: from.toISOString(), to: to.toISOString(), timezone: 'UTC' as const };
  }

  async recordProvider(input: z.input<typeof providerMetricRecordSchema>) {
    const parsed = providerMetricRecordSchema.parse(input);
    await this.operational.execute({
      sql: `INSERT OR IGNORE INTO analytics_outbox
        (tenant_id,event_id,event_type,payload_json,created_at,projected_at)
        VALUES (?,?,'PROVIDER_OUTCOME_RECORDED',?,?,NULL)`,
      args: [
        parsed.tenantId,
        parsed.eventId,
        JSON.stringify({
          kind: 'provider',
          caseId: parsed.caseId,
          providerId: parsed.providerId,
          operation: parsed.operation,
          outcome: parsed.outcome,
          latencyMs: Math.max(0, new Date(parsed.completedAt).getTime() - new Date(parsed.startedAt).getTime()),
          attemptCount: parsed.attemptCount,
          retryCount: parsed.retryCount,
          inputUnits: null,
          outputUnits: null,
          costUsd: null,
          priceVersion: null,
        }),
        parsed.completedAt,
      ],
    });
    return parsed;
  }

  async recordEval(input: z.input<typeof evalMetricInputSchema>): Promise<void> {
    const parsed = evalMetricInputSchema.parse(input);
    await this.operational.execute({
      sql: `INSERT OR IGNORE INTO analytics_outbox
        (tenant_id,event_id,event_type,payload_json,created_at,projected_at)
        VALUES (?,?,'EVAL_SUMMARY_RECORDED',?,?,NULL)`,
      args: [
        parsed.tenantId,
        parsed.eventId,
        JSON.stringify({
          kind: 'eval',
          evalId: parsed.evalId,
          candidateId: parsed.candidateId,
          datasetVersion: parsed.datasetVersion,
          manifestDigest: parsed.manifestDigest,
          sourceRevision: parsed.sourceRevision,
          sourceDigest: parsed.sourceDigest,
          score: parsed.score,
          passed: parsed.passed,
        }),
        parsed.occurredAt,
      ],
    });
  }

  async recordWorkflowStep(input: z.input<typeof workflowStepMetricRecordSchema>) {
    const parsed = workflowStepMetricRecordSchema.parse(input);
    const durationMs = Math.max(0, new Date(parsed.completedAt).getTime() - new Date(parsed.startedAt).getTime());
    await this.operational.execute({
      sql: `INSERT OR IGNORE INTO analytics_outbox
        (tenant_id,event_id,event_type,payload_json,created_at,projected_at)
        VALUES (?,?,'WORKFLOW_STEP_COMPLETED',?,?,NULL)`,
      args: [
        parsed.tenantId,
        parsed.eventId,
        JSON.stringify({
          kind: 'workflow-step',
          caseId: parsed.caseId,
          workflowId: parsed.workflowId,
          runId: parsed.runId,
          stepId: parsed.stepId,
          outcome: parsed.outcome,
          durationMs,
        }),
        parsed.completedAt,
      ],
    });
    return parsed;
  }

  projectPending(tenantId: string): Promise<number> {
    let projected = 0;
    const run = this.#projectionQueue.then(async () => {
      projected = await this.#projectPending(tenantId);
    });
    this.#projectionQueue = run.then(
      () => undefined,
      () => undefined,
    );
    return run.then(() => projected);
  }

  async #projectPending(tenantId: string): Promise<number> {
    let projected = 0;
    let leasedCount: number;
    do {
      const now = this.clock.now();
      const leaseExpiresAt = new Date(now.getTime() + leaseMs).toISOString();
      await this.operational.execute({
        sql: `UPDATE analytics_outbox
          SET lease_owner=?,lease_expires_at=?,attempt_count=attempt_count+1
          WHERE rowid IN (
            SELECT rowid FROM analytics_outbox
            WHERE tenant_id=? AND projected_at IS NULL
              AND (lease_expires_at IS NULL OR lease_expires_at <= ?)
            ORDER BY created_at,event_id LIMIT 200
          )`,
        args: [this.#projectorId, leaseExpiresAt, tenantId, now.toISOString()],
      });
      const leased = await this.operational.execute({
        sql: `SELECT tenant_id,event_id,event_type,payload_json,created_at
          FROM analytics_outbox
          WHERE tenant_id=? AND projected_at IS NULL AND lease_owner=? AND lease_expires_at=?
          ORDER BY created_at,event_id`,
        args: [tenantId, this.#projectorId, leaseExpiresAt],
      });
      leasedCount = leased.rows.length;
      if (leasedCount === 0) return projected;
      const connection = await this.analytics.connect();
      try {
        for (const rawRow of leased.rows) {
          const row = outboxRowSchema.parse(rawRow);
          const payload = normalizePayload(JSON.parse(row.payload_json));
          if (payload.kind === 'case') {
            await connection.run(
              `INSERT OR IGNORE INTO kyc_case_events
                (tenant_id,event_id,case_id,event_type,status,occurred_at,jurisdiction,
                 policy_version,case_created_at) VALUES (?,?,?,?,?,?,?,?,?)`,
              [
                row.tenant_id,
                row.event_id,
                payload.caseId,
                row.event_type,
                payload.status,
                row.created_at,
                payload.jurisdiction ?? null,
                payload.policyVersion ?? null,
                payload.caseCreatedAt ?? null,
              ],
            );
          } else if (payload.kind === 'provider') {
            await connection.run(
              `INSERT OR IGNORE INTO kyc_provider_facts
                (tenant_id,event_id,case_id,provider_id,operation,outcome,latency_ms,
                 attempt_count,retry_count,input_units,output_units,cost_usd,price_version,occurred_at)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
              [
                row.tenant_id,
                row.event_id,
                payload.caseId,
                payload.providerId,
                payload.operation,
                payload.outcome,
                payload.latencyMs,
                payload.attemptCount,
                payload.retryCount,
                payload.inputUnits,
                payload.outputUnits,
                payload.costUsd,
                payload.priceVersion,
                row.created_at,
              ],
            );
          } else if (payload.kind === 'feedback') {
            await connection.run(
              `INSERT OR IGNORE INTO kyc_review_feedback_facts
                (tenant_id,event_id,case_id,review_id,extraction_useful,screening_useful,
                 risk_useful,evidence_useful,structured_response_count,false_positive_escalation,
                 curated_for_dataset,turnaround_ms,occurred_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
              [
                row.tenant_id,
                row.event_id,
                payload.caseId,
                payload.reviewId,
                payload.extractionUseful,
                payload.screeningUseful,
                payload.riskUseful,
                payload.evidenceUseful,
                payload.structuredResponseCount,
                payload.falsePositiveEscalation,
                payload.curatedForDataset,
                payload.turnaroundMs,
                row.created_at,
              ],
            );
          } else if (payload.kind === 'eval') {
            await connection.run(
              `INSERT OR IGNORE INTO kyc_eval_facts
                (tenant_id,event_id,eval_id,candidate_id,dataset_version,manifest_digest,
                 source_revision,source_digest,score,passed,occurred_at)
                 VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
              [
                row.tenant_id,
                row.event_id,
                payload.evalId,
                payload.candidateId,
                payload.datasetVersion,
                payload.manifestDigest,
                payload.sourceRevision ?? null,
                payload.sourceDigest ?? null,
                payload.score,
                payload.passed,
                row.created_at,
              ],
            );
          } else {
            await connection.run(
              `INSERT OR IGNORE INTO kyc_workflow_step_facts
                (tenant_id,event_id,case_id,workflow_id,run_id,step_id,outcome,duration_ms,
                 occurred_at) VALUES (?,?,?,?,?,?,?,?,?)`,
              [
                row.tenant_id,
                row.event_id,
                payload.caseId,
                payload.workflowId,
                payload.runId,
                payload.stepId,
                payload.outcome,
                payload.durationMs,
                row.created_at,
              ],
            );
          }
          await this.operational.execute({
            sql: `UPDATE analytics_outbox
              SET projected_at=?,lease_owner=NULL,lease_expires_at=NULL
              WHERE tenant_id=? AND event_id=? AND projected_at IS NULL AND lease_owner=?`,
            args: [this.clock.now().toISOString(), tenantId, row.event_id, this.#projectorId],
          });
          projected += 1;
        }
      } finally {
        connection.closeSync();
      }
    } while (leasedCount === 200);
    return projected;
  }

  async #projectionLag(tenantId: string) {
    const pending = await this.operational.execute({
      sql: `SELECT count(*) AS pending_count,min(created_at) AS oldest_pending_at
        FROM analytics_outbox WHERE tenant_id=? AND projected_at IS NULL`,
      args: [tenantId],
    });
    const row = pending.rows[0];
    return {
      pendingEvents: integer(row?.pending_count ?? 0),
      oldestPendingAt:
        row?.oldest_pending_at === null || row?.oldest_pending_at === undefined
          ? null
          : z.string().parse(row.oldest_pending_at),
    };
  }

  async summary(tenantId: string, input: MetricsWindowInput = {}) {
    const observationWindow = this.resolveWindow(input);
    await this.projectPending(tenantId);
    const connection = await this.analytics.connect();
    try {
      const result = await connection.runAndReadAll(
        `WITH eligible AS (
           SELECT * FROM kyc_case_events WHERE tenant_id=? AND occurred_at<?
         ), ranked AS (
           SELECT case_id,status,occurred_at,policy_version,jurisdiction,case_created_at,
             row_number() OVER (PARTITION BY case_id ORDER BY occurred_at DESC,event_id DESC) AS rank
           FROM eligible
         ), case_flags AS (
           SELECT case_id,
             max(CASE WHEN status='ESCALATED' THEN 1 ELSE 0 END) AS escalated,
             max(CASE WHEN status='MISSING_INFORMATION' THEN 1 ELSE 0 END) AS missing_information
           FROM eligible GROUP BY case_id
         )
         SELECT count(*) AS sample_count,
           count(*) FILTER (WHERE ranked.status='ACTIVE') AS active_count,
           count(*) FILTER (WHERE ranked.status='REJECTED') AS rejected_count,
           count(*) FILTER (WHERE ranked.status='ESCALATED') AS escalated_count,
           count(*) FILTER (WHERE ranked.status='PROVISIONING_FAILED') AS provisioning_failed_count,
           coalesce(sum(case_flags.escalated),0) AS ever_escalated_count,
           coalesce(sum(case_flags.missing_information),0) AS missing_information_count,
           quantile_disc(epoch_ms(CAST(ranked.occurred_at AS TIMESTAMP))-
             epoch_ms(CAST(ranked.case_created_at AS TIMESTAMP)),0.5)
             FILTER (WHERE ranked.case_created_at IS NOT NULL AND
               ranked.status IN ('ACTIVE','REJECTED','PROVISIONING_FAILED')) AS p50_end_to_end,
           quantile_disc(epoch_ms(CAST(ranked.occurred_at AS TIMESTAMP))-
             epoch_ms(CAST(ranked.case_created_at AS TIMESTAMP)),0.95)
             FILTER (WHERE ranked.case_created_at IS NOT NULL AND
               ranked.status IN ('ACTIVE','REJECTED','PROVISIONING_FAILED')) AS p95_end_to_end,
           count(ranked.case_created_at) FILTER (WHERE
             ranked.status IN ('ACTIVE','REJECTED','PROVISIONING_FAILED')) AS latency_sample_count
         FROM ranked LEFT JOIN case_flags USING (case_id)
         WHERE ranked.rank=1 AND ranked.occurred_at>=?`,
        [tenantId, observationWindow.to, observationWindow.from],
      );
      const row = result.getRowObjectsJS()[0];
      if (row === undefined) throw new Error('Analytics summary did not return a row');
      const sampleCount = integer(row.sample_count);
      const active = integer(row.active_count);
      const rejected = integer(row.rejected_count);
      const finalEscalated = integer(row.escalated_count);
      const provisioningFailed = integer(row.provisioning_failed_count);
      const latencySampleCount = integer(row.latency_sample_count);
      const stepsResult = await connection.runAndReadAll(
        `SELECT step_id AS step,count(*) AS sample_count,
           quantile_disc(duration_ms,0.5) AS p50_latency,
           quantile_disc(duration_ms,0.95) AS p95_latency
         FROM kyc_workflow_step_facts
         WHERE tenant_id=? AND occurred_at>=? AND occurred_at<?
         GROUP BY step_id ORDER BY step_id`,
        [tenantId, observationWindow.from, observationWindow.to],
      );
      const dimensionResult = await connection.runAndReadAll(
        `WITH ranked AS (
           SELECT occurred_at,policy_version,jurisdiction,
             row_number() OVER (PARTITION BY case_id ORDER BY occurred_at DESC,event_id DESC) AS rank
           FROM kyc_case_events WHERE tenant_id=? AND occurred_at<?
         ) SELECT policy_version,jurisdiction,count(*) AS sample_count
         FROM ranked WHERE rank=1 AND occurred_at>=?
         GROUP BY policy_version,jurisdiction ORDER BY policy_version,jurisdiction`,
        [tenantId, observationWindow.to, observationWindow.from],
      );
      const feedbackResult = await connection.runAndReadAll(
        `SELECT count(*) AS sample_count,
           quantile_disc(turnaround_ms,0.5) AS p50_turnaround,
           quantile_disc(turnaround_ms,0.95) AS p95_turnaround,
           count(*) FILTER (WHERE extraction_useful) AS extraction_useful,
           count(*) FILTER (WHERE extraction_useful=false) AS extraction_incorrect,
           count(*) FILTER (WHERE screening_useful) AS screening_useful,
           count(*) FILTER (WHERE screening_useful=false) AS screening_incorrect,
           count(*) FILTER (WHERE risk_useful) AS risk_useful,
           count(*) FILTER (WHERE risk_useful=false) AS risk_incorrect,
           count(*) FILTER (WHERE evidence_useful) AS evidence_useful,
           count(*) FILTER (WHERE evidence_useful=false) AS evidence_incorrect,
           count(*) FILTER (WHERE curated_for_dataset AND false_positive_escalation IS NOT NULL)
             AS false_positive_denominator,
           count(*) FILTER (WHERE curated_for_dataset AND false_positive_escalation=true)
             AS false_positive_count
         FROM kyc_review_feedback_facts
         WHERE tenant_id=? AND occurred_at>=? AND occurred_at<?`,
        [tenantId, observationWindow.from, observationWindow.to],
      );
      const feedback = feedbackResult.getRowObjectsJS()[0];
      if (feedback === undefined) throw new Error('Analytics feedback did not return a row');
      const reviewSampleCount = integer(feedback.sample_count);
      const falsePositiveDenominator = integer(feedback.false_positive_denominator);
      const feedbackCategory = (category: 'extraction' | 'screening' | 'risk' | 'evidence') => {
        const useful = integer(feedback[`${category}_useful`]);
        const incorrect = integer(feedback[`${category}_incorrect`]);
        return { category, useful, incorrect, notAnswered: reviewSampleCount - useful - incorrect };
      };
      const dimensions = dimensionResult.getRowObjectsJS();
      const policyCounts = new Map<string, number>();
      const jurisdictionCounts = new Map<string, number>();
      for (const dimension of dimensions) {
        const count = integer(dimension.sample_count);
        if (dimension.policy_version !== null) {
          const policyVersion = z.string().parse(dimension.policy_version);
          policyCounts.set(policyVersion, (policyCounts.get(policyVersion) ?? 0) + count);
        }
        if (dimension.jurisdiction !== null) {
          const jurisdiction = z.string().parse(dimension.jurisdiction);
          jurisdictionCounts.set(jurisdiction, (jurisdictionCounts.get(jurisdiction) ?? 0) + count);
        }
      }
      return metricsSummarySchema.parse({
        schemaVersion: metricsSchemaVersion,
        observationWindow,
        sampleCount,
        denominator: sampleCount,
        finalStatusCounts: { active, rejected, escalated: finalEscalated, provisioningFailed },
        rates: {
          approval: rate(active, sampleCount),
          rejection: rate(rejected, sampleCount),
          escalation: rate(integer(row.ever_escalated_count), sampleCount),
          missingInformation: rate(integer(row.missing_information_count), sampleCount),
        },
        latencyMs: {
          endToEnd: {
            sampleCount: latencySampleCount,
            p50: available(numeric(row.p50_end_to_end), latencySampleCount),
            p95: available(numeric(row.p95_end_to_end), latencySampleCount),
          },
          steps: stepsResult.getRowObjectsJS().map(step => {
            const stepSampleCount = integer(step.sample_count);
            return {
              step: z.string().parse(step.step),
              sampleCount: stepSampleCount,
              p50: available(numeric(step.p50_latency), stepSampleCount),
              p95: available(numeric(step.p95_latency), stepSampleCount),
            };
          }),
        },
        dimensions: {
          policies: [...policyCounts].map(([policyVersion, count]) => ({
            policyVersion,
            sampleCount: count,
          })),
          jurisdictions: [...jurisdictionCounts].map(([jurisdiction, count]) => ({
            jurisdiction,
            sampleCount: count,
          })),
        },
        review: {
          sampleCount: reviewSampleCount,
          turnaroundMs: {
            p50: available(numeric(feedback.p50_turnaround), reviewSampleCount),
            p95: available(numeric(feedback.p95_turnaround), reviewSampleCount),
          },
          feedback: [
            feedbackCategory('extraction'),
            feedbackCategory('screening'),
            feedbackCategory('risk'),
            feedbackCategory('evidence'),
          ],
          falsePositiveEscalation: {
            sampleCount: integer(feedback.false_positive_count),
            denominator: falsePositiveDenominator,
            rate: rate(integer(feedback.false_positive_count), falsePositiveDenominator),
          },
        },
        projectionLag: await this.#projectionLag(tenantId),
      });
    } finally {
      connection.closeSync();
    }
  }

  async providers(tenantId: string, input: MetricsWindowInput = {}) {
    const observationWindow = this.resolveWindow(input);
    await this.projectPending(tenantId);
    const connection = await this.analytics.connect();
    try {
      const result = await connection.runAndReadAll(
        `WITH windowed AS (
           SELECT * FROM kyc_provider_facts
           WHERE tenant_id=? AND occurred_at>=? AND occurred_at<?
         ), provider_aggregates AS (
         SELECT provider_id,count(*) AS sample_count,
           count(*) FILTER (WHERE outcome='success') AS success_count,
           count(*) FILTER (WHERE outcome='timeout') AS timeout_count,
           count(*) FILTER (WHERE retry_count>0) AS retry_count,
           count(*) FILTER (WHERE outcome='error') AS error_count,
           count(latency_ms) AS latency_sample_count,
           quantile_disc(latency_ms,0.5) FILTER (WHERE latency_ms IS NOT NULL) AS p50_latency,
           quantile_disc(latency_ms,0.95) FILTER (WHERE latency_ms IS NOT NULL) AS p95_latency,
           coalesce(sum(input_units),0) AS input_units,
           coalesce(sum(output_units),0) AS output_units,
           count(cost_usd) AS usage_denominator,
           sum(cost_usd) AS cost_usd,
           string_agg(DISTINCT price_version,',' ORDER BY price_version)
             FILTER (WHERE price_version IS NOT NULL AND price_version NOT LIKE 'unpriced-%')
             AS price_versions
         FROM windowed GROUP BY provider_id
         ), case_costs AS (
           SELECT provider_id,case_id,sum(cost_usd) AS case_cost
           FROM windowed WHERE case_id IS NOT NULL
           GROUP BY provider_id,case_id
           HAVING count(cost_usd)=count(*)
         ), cost_aggregates AS (
           SELECT provider_id,count(*) AS cost_case_count,
             quantile_disc(case_cost,0.5) AS p50_case_cost,
             quantile_disc(case_cost,0.95) AS p95_case_cost
           FROM case_costs GROUP BY provider_id
         ) SELECT provider_aggregates.*,coalesce(cost_case_count,0) AS cost_case_count,
             p50_case_cost,p95_case_cost
           FROM provider_aggregates LEFT JOIN cost_aggregates USING (provider_id)
           ORDER BY provider_id`,
        [tenantId, observationWindow.from, observationWindow.to],
      );
      const providers = result.getRowObjectsJS().map(row => {
        const sampleCount = integer(row.sample_count);
        const latencySampleCount = integer(row.latency_sample_count);
        const usageDenominator = integer(row.usage_denominator);
        const costCaseCount = integer(row.cost_case_count);
        return {
          providerId: z.string().parse(row.provider_id),
          sampleCount,
          outcomes: {
            success: integer(row.success_count),
            timeout: integer(row.timeout_count),
            retry: integer(row.retry_count),
            error: integer(row.error_count),
          },
          rates: {
            success: rate(integer(row.success_count), sampleCount),
            timeout: rate(integer(row.timeout_count), sampleCount),
            retry: rate(integer(row.retry_count), sampleCount),
          },
          latencyMs: {
            sampleCount: latencySampleCount,
            p50: available(numeric(row.p50_latency), latencySampleCount),
            p95: available(numeric(row.p95_latency), latencySampleCount),
          },
          usage: {
            denominator: usageDenominator,
            inputUnits: integer(row.input_units),
            outputUnits: integer(row.output_units),
            costUsd: available(currency(numeric(row.cost_usd)), usageDenominator),
            costPerCaseUsd: {
              p50: available(currency(numeric(row.p50_case_cost)), costCaseCount),
              p95: available(currency(numeric(row.p95_case_cost)), costCaseCount),
            },
            priceVersions: row.price_versions === null ? [] : z.string().parse(row.price_versions).split(','),
          },
        };
      });
      return providerMetricsSchema.parse({
        schemaVersion: metricsSchemaVersion,
        observationWindow,
        sampleCount: providers.reduce((sum, provider) => sum + provider.sampleCount, 0),
        providers,
        projectionLag: await this.#projectionLag(tenantId),
      });
    } finally {
      connection.closeSync();
    }
  }

  async evals(tenantId: string, input: MetricsWindowInput = {}) {
    const observationWindow = this.resolveWindow(input);
    await this.projectPending(tenantId);
    const connection = await this.analytics.connect();
    try {
      const result = await connection.runAndReadAll(
        `SELECT eval_id,candidate_id,dataset_version,manifest_digest,source_revision,source_digest,
           count(*) AS sample_count,count(*) FILTER (WHERE passed) AS passed_count,
           quantile_disc(score,0.5) AS p50_score,quantile_disc(score,0.95) AS p95_score
         FROM kyc_eval_facts
         WHERE tenant_id=? AND occurred_at>=? AND occurred_at<?
         GROUP BY eval_id,candidate_id,dataset_version,manifest_digest,source_revision,source_digest
         ORDER BY eval_id,candidate_id`,
        [tenantId, observationWindow.from, observationWindow.to],
      );
      const evals = result.getRowObjectsJS().map(row => {
        const sampleCount = integer(row.sample_count);
        return {
          evalId: z.string().parse(row.eval_id),
          candidateId: z.string().parse(row.candidate_id),
          datasetVersion: z.string().parse(row.dataset_version),
          manifestDigest: z.string().parse(row.manifest_digest),
          sampleCount,
          passedCount: integer(row.passed_count),
          score: {
            p50: available(numeric(row.p50_score), sampleCount),
            p95: available(numeric(row.p95_score), sampleCount),
          },
        };
      });
      return evalMetricsSchema.parse({
        schemaVersion: metricsSchemaVersion,
        observationWindow,
        sampleCount: evals.reduce((sum, item) => sum + item.sampleCount, 0),
        evals,
        projectionLag: await this.#projectionLag(tenantId),
      });
    } finally {
      connection.closeSync();
    }
  }
}
