import type { PubSub } from '@mastra/core/events';
import { createHash } from 'node:crypto';
import { z } from 'zod';

import type { OperationalStore } from '../db/operational-store.js';
import { hasUnresolvedOutboxDeadLetter, persistOutboxDeadLetter } from '../db/outbox-operations.js';
import {
  hasWorkflowRun,
  SECURITY_INCIDENT_WORKFLOW_ID,
  type StartInvestigationInput,
} from '../db/workflow-run-operations.js';
import { persistStandaloneDeadLetter } from '../db/webhook-operations.js';
import type { StructuredLogger } from '../logging.js';
import { DomainEventSchema } from '../schemas/domain-event.js';
import { opaqueId } from '../schemas/common.js';
import { createTraceCarrier, WorkflowTraceCarrierSchema, startWorkflowBoundary } from '../mastra/observability.js';

const workerEventSchema = DomainEventSchema.extend({
  type: z.literal('security.alert.received'),
  data: DomainEventSchema.shape.data.extend({
    payload: z.object({ alertId: opaqueId }).passthrough(),
  }),
});

type WorkflowRun = Readonly<{
  startAsync(input: {
    inputData: StartInvestigationInput;
    requestContext?: ReturnType<typeof createTraceCarrier>['requestContext'];
    tracingOptions?: ReturnType<typeof createTraceCarrier>['tracingOptions'];
  }): Promise<{ runId: string }>;
}>;

export interface IngestionWorkflow {
  createRun(options: { runId: string; resourceId: string }): Promise<WorkflowRun>;
}

export async function startWorkflowWorker(
  input: Readonly<{
    pubsub: PubSub;
    workflow: IngestionWorkflow;
    store: OperationalStore;
    logger: StructuredLogger;
    maxAttempts: number;
    retryBackoffMs?: readonly number[];
    concurrency?: number;
    consumerGroup?: string;
    random?: () => number;
    schedule?: (delayMs: number) => Promise<void>;
  }>,
): Promise<() => Promise<void>> {
  const callback = async (
    delivered: Parameters<Parameters<PubSub['subscribe']>[1]>[0],
    ack?: () => Promise<void>,
    nack?: () => Promise<void>,
  ) => {
    const parsed = workerEventSchema.safeParse({
      type: delivered.type,
      runId: delivered.runId,
      data: delivered.data,
    });
    if (!parsed.success) {
      await persistTransportPoison(input.store, delivered);
      input.logger.write({
        event: 'worker.dead_lettered',
        errorCode: 'EVENT_INVALID',
        stepId: 'transport-schema',
      });
      await ack?.();
      return;
    }
    const event = parsed.data;
    // A syntactically valid transport payload is still untrusted input.
    // Bind it to the authoritative outbox envelope before claiming, starting,
    // or ACKing any effect; a copied eventId must not execute another tenant's
    // source entry.
    if (!(await matchesOutboxEnvelope(input.store, delivered, event.data.eventId))) {
      await persistTransportPoison(input.store, delivered);
      input.logger.write({
        event: 'worker.dead_lettered',
        errorCode: 'EVENT_INVALID',
        stepId: 'outbox-binding',
      });
      // This delivery copied an authoritative event id but failed the complete
      // envelope binding. The standalone DLQ commit above is its terminal
      // record; it must not stay pending forever or mutate the copied source
      // ledger/outbox.
      await ack?.();
      return;
    }
    const effect = await claimConsumerEffect(input.store, event.data.tenantId, event.data.eventId);
    if (effect.state === 'terminal' || effect.state === 'busy') {
      input.logger.write({
        event: 'worker.no_op',
        correlationId: event.data.correlationId,
        incidentId: event.data.incidentId,
        workflowRunId: event.data.eventId,
      });
      // A busy claimant still owns the delivery; only terminal work is ACKed.
      if (effect.state === 'terminal') await ack?.();
      return;
    }
    if (await hasUnresolvedOutboxDeadLetter(input.store, event.data.eventId)) {
      input.logger.write({
        event: 'worker.no_op',
        correlationId: event.data.correlationId,
        incidentId: event.data.incidentId,
        workflowRunId: event.data.eventId,
        errorCode: 'WORKFLOW_START_FAILED',
      });
      const terminal = await deadLetterConsumerEffect(
        input.store,
        event.data.tenantId,
        event.data.eventId,
        effect.attemptCount,
        effect.fenceToken,
      );
      if (terminal) await ack?.();
      return;
    }
    if (await hasWorkflowRun(input.store, event.data.eventId)) {
      input.logger.write({
        event: 'worker.no_op',
        correlationId: event.data.correlationId,
        incidentId: event.data.incidentId,
        workflowRunId: event.data.eventId,
      });
      const completed = await completeConsumerEffect(
        input.store,
        event.data.tenantId,
        event.data.eventId,
        effect.attemptCount,
        effect.fenceToken,
      );
      if (completed) await ack?.();
      return;
    }
    try {
      const propagatedTrace = traceContext(event.data.payload);
      const consumed = startWorkflowBoundary({
        boundary: 'pubsub.consume',
        tenantId: event.data.tenantId,
        incidentId: event.data.incidentId,
        runId: propagatedTrace?.runId ?? event.data.eventId,
        correlationId: event.data.correlationId,
        requestId: propagatedTrace?.requestId ?? event.data.eventId,
        ...(propagatedTrace ? { context: propagatedTrace } : {}),
      });
      const run = await input.workflow.createRun({
        runId: event.data.eventId,
        resourceId: event.data.incidentId,
      });
      const traceCarrier = createTraceCarrier({
        tenantId: event.data.tenantId,
        incidentId: event.data.incidentId,
        runId: event.data.eventId,
        correlationId: event.data.correlationId,
        requestId: propagatedTrace?.requestId ?? event.data.eventId,
      });
      let started;
      try {
        const workflow = startWorkflowBoundary({
          boundary: 'workflow.start',
          tenantId: event.data.tenantId,
          incidentId: event.data.incidentId,
          runId: propagatedTrace?.runId ?? event.data.eventId,
          correlationId: event.data.correlationId,
          requestId: propagatedTrace?.requestId ?? event.data.eventId,
          context: consumed.context,
        });
        try {
          // Advance the durable continuation to the workflow boundary before
          // its first step materializes the operational run. Later suspend /
          // resume steps therefore descend from workflow.start rather than
          // reopening the outbox.publish parent as a sibling.
          if (propagatedTrace)
            await input.store.execute({
              sql: `UPDATE outbox_events SET payload_json = json_set(
                payload_json, '$.__traceContext', ?
              ) WHERE id = ?`,
              args: [
                JSON.stringify({
                  ...workflow.context,
                  runId: event.data.eventId,
                  requestId: propagatedTrace.requestId,
                }),
                event.data.eventId,
              ],
            });
          started = await run.startAsync({
            inputData: {
              eventId: event.data.eventId,
              incidentId: event.data.incidentId,
              tenantId: event.data.tenantId,
              alertId: event.data.payload.alertId,
              correlationId: event.data.correlationId,
            },
            ...traceCarrier,
          });
          workflow.span.end({ attributes: { success: true } as never });
        } catch (error) {
          workflow.span.error({ error: error as Error, endSpan: true });
          throw error;
        }
      } finally {
        consumed.span.end({ attributes: { success: true } as never });
      }
      input.logger.write({
        event: 'worker.started',
        correlationId: event.data.correlationId,
        incidentId: event.data.incidentId,
        workflowRunId: started.runId,
      });
      const completed = await completeConsumerEffect(
        input.store,
        event.data.tenantId,
        event.data.eventId,
        effect.attemptCount,
        effect.fenceToken,
      );
      if (completed) await ack?.();
    } catch {
      const attempt = effect.attemptCount;
      if (attempt < input.maxAttempts && nack) {
        input.logger.write({
          event: 'worker.retry',
          correlationId: event.data.correlationId,
          incidentId: event.data.incidentId,
          errorCode: 'WORKFLOW_START_FAILED',
          attempt,
        });
        const cap = input.retryBackoffMs?.[attempt - 1] ?? 500 * 2 ** (attempt - 1);
        // Delay NACK so each redelivery observes the capped full-jitter policy
        // instead of becoming a hot retry loop.
        const jitter = Math.min(1, Math.max(0, (input.random ?? Math.random)()));
        await (input.schedule ?? delay)(Math.floor(cap * jitter));
        await releaseConsumerEffect(input.store, event.data.tenantId, event.data.eventId, attempt, effect.fenceToken);
        await nack();
        return;
      }
      const terminal = await persistOutboxDeadLetter(input.store, {
        outboxId: event.data.eventId,
        errorCode: 'WORKFLOW_START_FAILED',
        attemptCount: attempt,
        createdAt: new Date().toISOString(),
      });
      if (terminal === 'outbox_missing') {
        await persistStandaloneDeadLetter(input.store, {
          eventType: event.type,
          eventRef: `event:${event.data.eventId}`,
          errorCode: 'WORKFLOW_START_FAILED',
          tenantId: event.data.tenantId,
          incidentId: event.data.incidentId,
        });
      }
      input.logger.write({
        event: terminal === 'workflow_run_exists' ? 'worker.no_op' : 'worker.dead_lettered',
        correlationId: event.data.correlationId,
        incidentId: event.data.incidentId,
        errorCode: 'WORKFLOW_START_FAILED',
        attempt,
      });
      const deadLettered = await deadLetterConsumerEffect(
        input.store,
        event.data.tenantId,
        event.data.eventId,
        attempt,
        effect.fenceToken,
      );
      if (deadLettered) await ack?.();
    }
  };
  const subscribers = Math.max(1, Math.min(16, input.concurrency ?? 1));
  const semaphore = createSemaphore(subscribers);
  const callbacks = Array.from(
    { length: subscribers },
    () =>
      async (...args: Parameters<typeof callback>) =>
        semaphore.run(() => callback(...args)),
  );
  await Promise.all(
    callbacks.map(subscriber =>
      input.pubsub.subscribe('security.alert.received', subscriber, {
        group: input.consumerGroup ?? 'security-workflow-starters',
      }),
    ),
  );
  return async () => {
    await Promise.all(callbacks.map(subscriber => input.pubsub.unsubscribe('security.alert.received', subscriber)));
  };
}

function traceContext(payload: unknown):
  | Readonly<{
      traceId: string;
      parentSpanId?: string;
      runId: string;
      requestId: string;
    }>
  | undefined {
  const raw = payload && typeof payload === 'object' ? (payload as Record<string, unknown>).__traceContext : undefined;
  let value: unknown = raw;
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw) as unknown;
    } catch {
      return undefined;
    }
  }
  return WorkflowTraceCarrierSchema.safeParse(value).data;
}

/**
 * A parsed but non-authoritative envelope is transport poison. The serialized
 * value is used only to calculate a digest, then discarded; the database
 * receives no raw event data or tenant-supplied PII.
 */
async function persistTransportPoison(
  store: OperationalStore,
  delivered: Readonly<{
    id?: unknown;
    type?: unknown;
    runId?: unknown;
    data?: unknown;
  }>,
): Promise<void> {
  const bytes = new TextEncoder().encode(
    canonicalJson({
      id: delivered.id ?? null,
      type: delivered.type ?? null,
      runId: delivered.runId ?? null,
      data: delivered.data ?? null,
    }),
  );
  const payloadHash = createHash('sha256').update(bytes).digest('hex');
  await persistStandaloneDeadLetter(store, {
    eventType: 'security.alert.received',
    eventRef: `transport:${payloadHash}`,
    errorCode: 'EVENT_INVALID',
  });
}

/**
 * A malformed body may still carry an `eventId`; it is not authority by
 * itself. Bind every envelope field to the source outbox row before a worker
 * can dead-letter that source or change its consumer ledger.
 */
async function matchesOutboxEnvelope(
  store: OperationalStore,
  delivered: Readonly<{ type?: unknown; runId?: unknown; data?: unknown }>,
  eventId: string,
): Promise<boolean> {
  const data = delivered.data;
  if (!data || typeof data !== 'object') return false;
  const raw = data as Record<string, unknown>;
  const row = await store.execute({
    sql: `SELECT type, run_id, incident_id, tenant_id, schema_version, correlation_id,
      causation_id, payload_json, occurred_at
      FROM outbox_events WHERE id = ?`,
    args: [eventId],
  });
  const source = row.rows[0];
  return Boolean(
    source &&
    delivered.type === source.type &&
    delivered.runId === source.run_id &&
    raw.incidentId === source.incident_id &&
    raw.tenantId === source.tenant_id &&
    raw.schemaVersion === source.schema_version &&
    raw.correlationId === source.correlation_id &&
    raw.occurredAt === source.occurred_at &&
    (raw.causationId ?? null) === source.causation_id &&
    samePayloadExceptTrace(raw.payload, JSON.parse(String(source.payload_json))),
  );
}

function samePayloadExceptTrace(left: unknown, right: unknown): boolean {
  if (!left || typeof left !== 'object' || !right || typeof right !== 'object')
    return canonicalJson(left) === canonicalJson(right);
  const candidate = { ...(left as Record<string, unknown>) };
  const source = { ...(right as Record<string, unknown>) };
  const candidateCarrier = parseTraceCarrier(candidate);
  const sourceCarrier = parseTraceCarrier(source);
  delete candidate.__traceContext;
  delete source.__traceContext;
  if (canonicalJson(candidate) !== canonicalJson(source)) return false;
  if (candidateCarrier.state !== sourceCarrier.state) return false;
  // A malformed carrier must never be accepted merely because the candidate
  // copied the same malformed bytes from an untrusted transport envelope.
  if (candidateCarrier.state === 'invalid') return false;
  if (candidateCarrier.state !== 'present') return true;
  if (sourceCarrier.state !== 'present') return false;
  const candidateIdentity = { ...candidateCarrier.value };
  const sourceIdentity = { ...sourceCarrier.value };
  delete candidateIdentity.parentSpanId;
  delete sourceIdentity.parentSpanId;
  // The outbox advances only the parent span after a successful consume/start
  // boundary. A concurrent Redis delivery can therefore carry the immediately
  // preceding parent while every source-bound identity remains equal. Accept
  // that redelivery so the consumer ledger can resolve it as an idempotent
  // no-op; any change to trace, scope, run, request, or payload still fails.
  return canonicalJson(candidateIdentity) === canonicalJson(sourceIdentity);
}

function parseTraceCarrier(payload: Record<string, unknown>):
  | Readonly<{ state: 'absent' }>
  | Readonly<{ state: 'invalid' }>
  | Readonly<{
      state: 'present';
      value: ReturnType<typeof WorkflowTraceCarrierSchema.parse>;
    }> {
  if (!('__traceContext' in payload)) return { state: 'absent' };
  const raw = payload.__traceContext;
  if (typeof raw !== 'string') return { state: 'invalid' };
  try {
    const parsed = WorkflowTraceCarrierSchema.safeParse(JSON.parse(raw));
    return parsed.success ? { state: 'present', value: parsed.data } : { state: 'invalid' };
  } catch {
    return { state: 'invalid' };
  }
}

function canonicalJson(value: unknown): string {
  const normalize = (item: unknown): unknown => {
    if (Array.isArray(item)) return item.map(normalize);
    if (item && typeof item === 'object')
      return Object.fromEntries(
        Object.entries(item as Record<string, unknown>)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([key, child]) => [key, normalize(child)]),
      );
    return item;
  };
  return JSON.stringify(normalize(value));
}

function delay(delayMs: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, delayMs));
}

function createSemaphore(limit: number) {
  let active = 0;
  const waiting: Array<() => void> = [];
  return {
    async run<T>(operation: () => Promise<T>): Promise<T> {
      if (active >= limit) await new Promise<void>(resolve => waiting.push(resolve));
      active += 1;
      try {
        return await operation();
      } finally {
        active -= 1;
        waiting.shift()?.();
      }
    },
  };
}

async function claimConsumerEffect(
  store: OperationalStore,
  tenantId: string,
  eventId: string,
): Promise<
  Readonly<{
    state: 'acquired' | 'busy' | 'terminal';
    attemptCount: number;
    fenceToken: string;
  }>
> {
  const now = new Date();
  const nowIso = now.toISOString();
  const lease = new Date(now.getTime() + 60_000).toISOString();
  return store.transaction(async tx => {
    const current = await tx.execute({
      sql: `SELECT status, attempt_count, lease_expires_at FROM consumer_effect_ledger
        WHERE tenant_id = ? AND consumer_group = 'security-workflow-starters' AND event_id = ?`,
      args: [tenantId, eventId],
    });
    const row = current.rows[0];
    if (row && ['completed', 'dead_lettered'].includes(String(row.status)))
      return {
        state: 'terminal',
        attemptCount: Number(row.attempt_count),
        fenceToken: String(row.fence_token),
      };
    if (row && String(row.lease_expires_at) > nowIso)
      return {
        state: 'busy',
        attemptCount: Number(row.attempt_count),
        fenceToken: String(row.fence_token),
      };
    const attempt = Number(row?.attempt_count ?? 0) + 1;
    if (row) {
      const updated = await tx.execute({
        sql: `UPDATE consumer_effect_ledger SET status = 'processing', attempt_count = ?,
          fence_token = ?, lease_expires_at = ?, completed_at = NULL
          WHERE consumer_group = 'security-workflow-starters' AND event_id = ?
            AND tenant_id = ? AND lease_expires_at <= ? AND status = 'processing'`,
        args: [attempt, `worker:${eventId}:${attempt}`, lease, eventId, tenantId, nowIso],
      });
      if (updated.rowsAffected !== 1)
        return {
          state: 'busy',
          attemptCount: attempt,
          fenceToken: String(row.fence_token),
        };
    } else {
      await tx.execute({
        sql: `INSERT INTO consumer_effect_ledger(
          tenant_id, consumer_group, event_id, status, attempt_count, fence_token, lease_expires_at
        ) VALUES (?, 'security-workflow-starters', ?, 'processing', ?, ?, ?)`,
        args: [tenantId, eventId, attempt, `worker:${eventId}:${attempt}`, lease],
      });
    }
    return {
      state: 'acquired',
      attemptCount: attempt,
      fenceToken: `worker:${eventId}:${attempt}`,
    };
  });
}

async function releaseConsumerEffect(
  store: OperationalStore,
  tenantId: string,
  eventId: string,
  attemptCount: number,
  fenceToken: string,
): Promise<void> {
  await store.execute({
    sql: `UPDATE consumer_effect_ledger SET lease_expires_at = ?
      WHERE tenant_id = ? AND consumer_group = 'security-workflow-starters' AND event_id = ?
        AND status = 'processing' AND attempt_count = ? AND fence_token = ?`,
    args: [new Date(0).toISOString(), tenantId, eventId, attemptCount, fenceToken],
  });
}

async function completeConsumerEffect(
  store: OperationalStore,
  tenantId: string,
  eventId: string,
  attemptCount: number,
  fenceToken: string,
): Promise<boolean> {
  const now = new Date().toISOString();
  const updated = await store.execute({
    sql: `UPDATE consumer_effect_ledger SET status = 'completed', completed_at = ?, lease_expires_at = ?
      WHERE tenant_id = ? AND consumer_group = 'security-workflow-starters' AND event_id = ?
        AND status = 'processing' AND attempt_count = ? AND fence_token = ?`,
    args: [now, now, tenantId, eventId, attemptCount, fenceToken],
  });
  return updated.rowsAffected === 1;
}

async function deadLetterConsumerEffect(
  store: OperationalStore,
  tenantId: string,
  eventId: string,
  attemptCount: number,
  fenceToken: string,
): Promise<boolean> {
  const now = new Date().toISOString();
  const updated = await store.execute({
    sql: `UPDATE consumer_effect_ledger SET status = 'dead_lettered', completed_at = ?, lease_expires_at = ?
      WHERE tenant_id = ? AND consumer_group = 'security-workflow-starters' AND event_id = ?
        AND status = 'processing' AND attempt_count = ? AND fence_token = ?`,
    args: [now, now, tenantId, eventId, attemptCount, fenceToken],
  });
  return updated.rowsAffected === 1;
}

export { SECURITY_INCIDENT_WORKFLOW_ID };
