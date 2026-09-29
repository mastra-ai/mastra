import type { Clock } from '../domain/clock.js';
import { randomUUID } from 'node:crypto';
import { systemClock } from '../domain/clock.js';
import { DomainError } from '../domain/errors.js';
import type { IdGenerator } from '../domain/id-generator.js';
import { uuidGenerator } from '../domain/id-generator.js';
import type { ExternalIncidentProjection, IncidentProvider } from '../providers/incident-provider.js';

// Linear create/update performs destination validation, marker reconciliation,
// the mutation, and an authoritative readback. A one-second budget routinely
// expires between those sequential API calls even on a healthy connection.
const DEFAULT_PROVIDER_TIMEOUT_MS = 10_000;
import { AmbiguousLinearCreateError, AmbiguousLinearUpdateError } from '../providers/linear-incident-provider.js';
import { ExternalIncidentResultSchema, ExternalIncidentSupersededError } from '../providers/incident-provider.js';
import type { OperationalStore, StoreTransaction } from './operational-store.js';

export type IncidentDeliveryOutcome = Readonly<{
  status: 'succeeded' | 'retry_scheduled' | 'exhausted' | 'in_progress' | 'uncertain';
  externalRef?: string;
  attemptCount: number;
}>;

export async function deliverExternalIncident(
  store: OperationalStore,
  provider: IncidentProvider,
  input: Readonly<{
    operation: 'open-awaiting-approval' | 'decision-rejected' | 'final-contained' | 'final-failed';
    projection: ExternalIncidentProjection;
    workflowRunId: string;
    correlationId: string;
    existingExternalRef?: string;
  }>,
  dependencies: Readonly<{
    clock?: Clock;
    ids?: IdGenerator;
    maxAttempts?: number;
    timeoutMs?: number;
  }> = {},
): Promise<IncidentDeliveryOutcome> {
  const clock = dependencies.clock ?? systemClock;
  const ids = dependencies.ids ?? uuidGenerator;
  const maxAttempts = dependencies.maxAttempts ?? 3;
  const timeoutMs = dependencies.timeoutMs ?? DEFAULT_PROVIDER_TIMEOUT_MS;
  const now = clock.now();
  // Existing callers can omit provider identity. The fallback is a persisted
  // compatibility value for the local adapter, never an external-provider fallback.
  const providerId = provider.providerId ?? 'local-incident';
  const idempotencyKey = `${providerId}:${input.projection.incidentId}:${input.operation}`;
  const deliveryId = `delivery_${providerId}_${input.projection.incidentId}_${input.operation}`;
  const proposedGenerationFenceToken = `provider-generation:${randomUUID()}`;
  const leaseUntil = new Date(Date.parse(now) + timeoutMs * 2).toISOString();
  const claimed = await store.transaction(async tx => {
    const incidentGeneration = await tx.execute({
      sql: `SELECT version FROM incidents WHERE tenant_id = ? AND id = ?`,
      args: [input.projection.tenantId, input.projection.incidentId],
    });
    const generation = Number(incidentGeneration.rows[0]?.version);
    if (!Number.isSafeInteger(generation) || generation <= 0) {
      throw new DomainError('CONFLICT');
    }
    const generationClaim = await claimProviderGeneration(tx, {
      providerId,
      tenantId: input.projection.tenantId,
      incidentId: input.projection.incidentId,
      generation,
      fenceToken: proposedGenerationFenceToken,
      now,
      leaseExpiresAt: leaseUntil,
      serializeNetworkEffect: providerId === 'linear',
    });
    if (generationClaim.state === 'stale') {
      return {
        state: 'generation_superseded' as const,
        generation: generationClaim.generation,
        externalRef: generationClaim.externalRef,
      };
    }
    if (generationClaim.state === 'busy' || generationClaim.state === 'reconcile_required') {
      return {
        state: generationClaim.state,
        generation: generationClaim.generation,
        fenceToken: generationClaim.fenceToken,
      };
    }
    await tx.execute({
      sql: `INSERT OR IGNORE INTO provider_deliveries(
        id, provider, incident_id, tenant_id, operation, idempotency_key,
        status, attempt_count, next_attempt_at, projection_json,
        workflow_run_id, correlation_id, provider_generation, observed_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'pending', 0, ?, ?, ?, ?, ?, ?)`,
      args: [
        deliveryId,
        providerId,
        input.projection.incidentId,
        input.projection.tenantId,
        input.operation,
        idempotencyKey,
        now,
        JSON.stringify(input.projection),
        input.workflowRunId,
        input.correlationId,
        generation,
        now,
      ],
    });
    const current = await tx.execute({
      sql: `SELECT * FROM provider_deliveries
        WHERE provider = ? AND incident_id = ? AND operation = ?`,
      args: [providerId, input.projection.incidentId, input.operation],
    });
    const row = current.rows[0];
    if (!row) throw new DomainError('STORAGE_UNAVAILABLE');
    if (
      row.tenant_id !== input.projection.tenantId ||
      row.idempotency_key !== idempotencyKey ||
      row.projection_json !== JSON.stringify(input.projection) ||
      row.workflow_run_id !== input.workflowRunId ||
      !Number.isSafeInteger(Number(row.provider_generation)) ||
      Number(row.provider_generation) <= 0
    ) {
      throw new DomainError('CONFLICT');
    }
    if (row.status === 'succeeded') {
      return {
        state: 'succeeded' as const,
        row,
        generationFenceToken: generationClaim.fenceToken,
      };
    }
    if (row.status === 'exhausted') {
      return {
        state: 'exhausted' as const,
        row,
        generationFenceToken: generationClaim.fenceToken,
      };
    }
    if (row.status === 'uncertain') {
      return { state: 'uncertain' as const, row };
    }
    if (row.status === 'delivering' && String(row.next_attempt_at) > now) {
      return { state: 'in_progress' as const, row };
    }
    if (input.operation === 'final-failed') {
      const authoritative = await tx.execute({
        sql: `SELECT status FROM incidents WHERE tenant_id = ? AND id = ?`,
        args: [input.projection.tenantId, input.projection.incidentId],
      });
      if (['contained', 'closed'].includes(String(authoritative.rows[0]?.status))) {
        return { state: 'superseded' as const, row };
      }
    }
    let existingExternalRef = input.existingExternalRef;
    if (input.operation !== 'open-awaiting-approval' && !existingExternalRef) {
      const opened = await tx.execute({
        sql: `SELECT status, external_ref FROM provider_deliveries
          WHERE provider = ? AND tenant_id = ? AND incident_id = ?
            AND operation = 'open-awaiting-approval'`,
        args: [providerId, input.projection.tenantId, input.projection.incidentId],
      });
      if (opened.rows[0]?.status === 'exhausted') {
        return { state: 'dependency_exhausted' as const, row };
      }
      if (!opened.rows[0]?.external_ref) {
        return { state: 'in_progress' as const, row };
      }
      existingExternalRef = String(opened.rows[0].external_ref);
    }
    const updated = await tx.execute({
      sql: `UPDATE provider_deliveries SET status = 'delivering',
        attempt_count = attempt_count + 1, next_attempt_at = ?, error_code = NULL,
        observed_at = ?
        WHERE id = ? AND attempt_count = ?
          AND status IN ('pending','retry','delivering')
        RETURNING *`,
      args: [leaseUntil, now, String(row.id), Number(row.attempt_count)],
    });
    return updated.rows[0]
      ? {
          state: 'claimed' as const,
          row: updated.rows[0],
          existingExternalRef,
          generationFenceToken: generationClaim.fenceToken,
        }
      : { state: 'in_progress' as const, row };
  });
  if (claimed.state === 'generation_superseded') {
    return {
      // A higher durable generation owns the projection. Treating the stale
      // work as a successful no-op prevents an old workflow retry from
      // re-opening dispatch while preserving the current external reference.
      status: 'succeeded',
      ...(claimed.externalRef ? { externalRef: claimed.externalRef } : {}),
      attemptCount: 0,
    };
  }
  if (claimed.state === 'succeeded' || claimed.state === 'exhausted') {
    await terminalizeProviderGeneration(store, {
      providerId,
      tenantId: input.projection.tenantId,
      incidentId: input.projection.incidentId,
      generation: Number(claimed.row.provider_generation),
      fenceToken: claimed.generationFenceToken,
      ...(claimed.row.external_ref ? { externalRef: String(claimed.row.external_ref) } : {}),
    });
    return {
      status: claimed.state,
      ...(claimed.row.external_ref ? { externalRef: String(claimed.row.external_ref) } : {}),
      attemptCount: Number(claimed.row.attempt_count),
    };
  }
  if (claimed.state === 'reconcile_required') {
    // An expired lease is not permission to overwrite an old request: its SDK
    // response may simply have been lost. Reconcile the exact remote marker
    // first, then require the newer generation to be dispatched on a later
    // delivery pass after the old ledger row is terminal.
    await reconcileExpiredProviderGeneration(store, provider, {
      providerId,
      tenantId: input.projection.tenantId,
      incidentId: input.projection.incidentId,
      generation: claimed.generation,
      fenceToken: claimed.fenceToken,
      now,
    });
    return { status: 'in_progress', attemptCount: 0 };
  }
  if (claimed.state === 'busy') {
    return { status: 'in_progress', attemptCount: 0 };
  }
  if (claimed.state === 'superseded') {
    await persistDeliveryOutcome(
      store,
      providerId,
      input,
      {
        deliveryId: String(claimed.row.id),
        expectedAttempt: Number(claimed.row.attempt_count),
        expectedState: 'active',
        status: 'exhausted',
        nextAttemptAt: null,
        externalRef: null,
        errorCode: 'PROVIDER_DELIVERY_SUPERSEDED',
        auditStatus: 'exhausted',
        generationFence: generationFence(claimed.row, claimed.generationFenceToken),
      },
      ids,
      clock,
    );
    return {
      status: 'exhausted',
      attemptCount: Number(claimed.row.attempt_count),
    };
  }
  if (claimed.state === 'dependency_exhausted') {
    await persistDeliveryOutcome(
      store,
      providerId,
      input,
      {
        deliveryId: String(claimed.row.id),
        expectedAttempt: Number(claimed.row.attempt_count),
        expectedState: 'active',
        status: 'exhausted',
        nextAttemptAt: null,
        externalRef: null,
        errorCode: 'PROVIDER_DEPENDENCY_EXHAUSTED',
        auditStatus: 'exhausted',
        generationFence: generationFence(claimed.row, claimed.generationFenceToken),
      },
      ids,
      clock,
    );
    return {
      status: 'exhausted',
      attemptCount: Number(claimed.row.attempt_count),
    };
  }
  if (claimed.state !== 'claimed') {
    if (!('row' in claimed)) {
      // Exhaustive guard for generation-ledger states.  They are handled
      // above, but keeping this closed avoids accidentally treating a future
      // ledger state as a delivery row.
      return { status: 'in_progress', attemptCount: 0 };
    }
    const claimedRow = claimed.row;
    if (!claimedRow) return { status: 'in_progress', attemptCount: 0 };
    if (claimed.state === 'uncertain') {
      const reconciled = await provider.reconcile?.({
        operation: input.operation === 'open-awaiting-approval' ? 'create' : 'update',
        idempotencyKey,
        generation: Number(claimed.row.provider_generation),
        projection: input.projection,
        ...(claimed.row.external_ref ? { externalRef: String(claimed.row.external_ref) } : {}),
      });
      if (!reconciled) {
        return {
          status: 'uncertain',
          attemptCount: Number(claimed.row.attempt_count),
        };
      }
      await persistDeliveryOutcome(
        store,
        providerId,
        input,
        {
          deliveryId: String(claimed.row.id),
          expectedAttempt: Number(claimed.row.attempt_count),
          expectedState: 'active',
          status: 'succeeded',
          nextAttemptAt: null,
          externalRef: reconciled.externalRef,
          errorCode: null,
          auditStatus: 'succeeded',
          generationFence: generationFence(claimed.row, claimed.generationFenceToken),
        },
        ids,
        clock,
      );
      return {
        status: 'succeeded',
        externalRef: reconciled.externalRef,
        attemptCount: Number(claimed.row.attempt_count),
      };
    }
    return {
      status: claimed.state,
      ...(claimedRow.external_ref ? { externalRef: String(claimedRow.external_ref) } : {}),
      attemptCount: Number(claimedRow.attempt_count),
    };
  }
  const claimRow = claimed.row;
  if (!claimRow) throw new DomainError('STORAGE_UNAVAILABLE');
  const attempt = Number(claimRow.attempt_count);
  const generation = Number(claimRow.provider_generation);
  const generationFenceToken = claimed.generationFenceToken;
  if (
    !(await providerGenerationFenceCurrent(store, {
      providerId,
      tenantId: input.projection.tenantId,
      incidentId: input.projection.incidentId,
      generation,
      fenceToken: generationFenceToken,
      now,
    }))
  ) {
    return { status: 'in_progress', attemptCount: attempt };
  }
  if (input.operation === 'final-failed') {
    const authoritative = await store.execute({
      sql: `SELECT status FROM incidents WHERE tenant_id = ? AND id = ?`,
      args: [input.projection.tenantId, input.projection.incidentId],
    });
    if (['contained', 'closed'].includes(String(authoritative.rows[0]?.status))) {
      await persistDeliveryOutcome(
        store,
        providerId,
        input,
        {
          deliveryId: String(claimed.row.id),
          expectedAttempt: attempt,
          expectedState: 'delivering',
          status: 'exhausted',
          nextAttemptAt: null,
          externalRef: null,
          errorCode: 'PROVIDER_DELIVERY_SUPERSEDED',
          auditStatus: 'exhausted',
          generationFence: { generation, fenceToken: generationFenceToken },
        },
        ids,
        clock,
      );
      return { status: 'exhausted', attemptCount: attempt };
    }
  }
  let delivered: Awaited<ReturnType<IncidentProvider['create']>>;
  try {
    delivered = ExternalIncidentResultSchema.parse(
      await withTimeout(
        input.operation === 'open-awaiting-approval'
          ? provider.create({
              projection: input.projection,
              idempotencyKey,
              generation,
            })
          : provider.update({
              externalRef: claimed.existingExternalRef!,
              projection: input.projection,
              idempotencyKey,
              generation,
            }),
        timeoutMs,
      ),
    );
  } catch (error) {
    if (error instanceof ExternalIncidentSupersededError) {
      await persistDeliveryOutcome(
        store,
        providerId,
        input,
        {
          deliveryId: String(claimed.row.id),
          expectedAttempt: attempt,
          expectedState: 'delivering',
          status: 'exhausted',
          nextAttemptAt: null,
          externalRef: null,
          errorCode: 'PROVIDER_DELIVERY_SUPERSEDED',
          auditStatus: 'exhausted',
          generationFence: { generation, fenceToken: generationFenceToken },
        },
        ids,
        clock,
      );
      return { status: 'exhausted', attemptCount: attempt };
    }
    // Promise.race cannot cancel the SDK call.  Mark the effect uncertain and
    // only permit the provider's authoritative reconciliation hook to resolve
    // it; retrying create here could duplicate an issue that committed after
    // the local deadline.
    if (
      error instanceof TimeoutError ||
      error instanceof AmbiguousLinearCreateError ||
      error instanceof AmbiguousLinearUpdateError
    ) {
      await persistDeliveryOutcome(
        store,
        providerId,
        input,
        {
          deliveryId: String(claimed.row.id),
          expectedAttempt: attempt,
          expectedState: 'delivering',
          status: 'uncertain',
          nextAttemptAt: null,
          externalRef: null,
          errorCode: error instanceof TimeoutError ? 'PROVIDER_TIMEOUT' : 'PROVIDER_UNAVAILABLE',
          auditStatus: 'retry_scheduled',
          generationFence: { generation, fenceToken: generationFenceToken },
        },
        ids,
        clock,
      );
      return { status: 'uncertain', attemptCount: attempt };
    }
    const exhausted = attempt >= maxAttempts;
    const errorCode = error instanceof TimeoutError ? 'PROVIDER_TIMEOUT' : 'PROVIDER_UNAVAILABLE';
    const nextAttemptAt = exhausted ? null : new Date(Date.parse(now) + 250 * 2 ** (attempt - 1)).toISOString();
    await persistDeliveryOutcome(
      store,
      providerId,
      input,
      {
        deliveryId: String(claimed.row.id),
        expectedAttempt: attempt,
        expectedState: 'delivering',
        status: exhausted ? 'exhausted' : 'retry',
        nextAttemptAt,
        externalRef: null,
        errorCode,
        auditStatus: exhausted ? 'exhausted' : 'retry_scheduled',
        generationFence: { generation, fenceToken: generationFenceToken },
      },
      ids,
      clock,
    );
    return {
      status: exhausted ? 'exhausted' : 'retry_scheduled',
      attemptCount: attempt,
    };
  }
  try {
    if (
      !(await providerGenerationFenceCurrent(store, {
        providerId,
        tenantId: input.projection.tenantId,
        incidentId: input.projection.incidentId,
        generation,
        fenceToken: generationFenceToken,
        now: clock.now(),
      }))
    ) {
      return { status: 'in_progress', attemptCount: attempt };
    }
    await persistDeliveryOutcome(
      store,
      providerId,
      input,
      {
        deliveryId: String(claimed.row.id),
        expectedAttempt: attempt,
        expectedState: 'delivering',
        status: 'succeeded',
        nextAttemptAt: null,
        externalRef: delivered.externalRef,
        errorCode: null,
        auditStatus: 'succeeded',
        generationFence: { generation, fenceToken: generationFenceToken },
      },
      ids,
      clock,
    );
  } catch {
    const reconciled = await store.execute({
      sql: `SELECT status, external_ref FROM provider_deliveries WHERE id = ?`,
      args: [String(claimed.row.id)],
    });
    if (reconciled.rows[0]?.status === 'succeeded' && reconciled.rows[0].external_ref === delivered.externalRef) {
      return {
        status: 'succeeded',
        externalRef: delivered.externalRef,
        attemptCount: attempt,
      };
    }
    throw new DomainError('STORAGE_UNAVAILABLE', { retryable: true });
  }
  return {
    status: 'succeeded',
    externalRef: delivered.externalRef,
    attemptCount: attempt,
  };
}

async function claimProviderGeneration(
  tx: StoreTransaction,
  input: Readonly<{
    providerId: string;
    tenantId: string;
    incidentId: string;
    generation: number;
    fenceToken: string;
    now: string;
    leaseExpiresAt: string;
    /** Local receipts are atomic; only Linear has an SDK request that
     * can survive a process and arrive after a newer local generation. */
    serializeNetworkEffect: boolean;
  }>,
): Promise<
  | Readonly<{ state: 'claimed'; generation: number; fenceToken: string }>
  | Readonly<{ state: 'stale'; generation: number; externalRef?: string }>
  | Readonly<{ state: 'busy'; generation: number; fenceToken: string }>
  | Readonly<{
      state: 'reconcile_required';
      generation: number;
      fenceToken: string;
    }>
> {
  await tx.execute({
    sql: `INSERT OR IGNORE INTO provider_incident_generations(
      provider, tenant_id, incident_id, generation, fence_token, status,
      claimed_at, lease_expires_at
    ) VALUES (?, ?, ?, ?, ?, 'active', ?, ?)`,
    args: [
      input.providerId,
      input.tenantId,
      input.incidentId,
      input.generation,
      input.fenceToken,
      input.now,
      input.leaseExpiresAt,
    ],
  });
  const current = await tx.execute({
    sql: `SELECT generation, fence_token, status, lease_expires_at FROM provider_incident_generations
      WHERE provider = ? AND tenant_id = ? AND incident_id = ?`,
    args: [input.providerId, input.tenantId, input.incidentId],
  });
  const row = current.rows[0];
  const currentGeneration = Number(row?.generation);
  if (!Number.isSafeInteger(currentGeneration) || currentGeneration <= 0) throw new DomainError('STORAGE_UNAVAILABLE');
  if (currentGeneration > input.generation) {
    const ref = await tx.execute({
      sql: `SELECT external_ref FROM provider_deliveries
        WHERE provider = ? AND tenant_id = ? AND incident_id = ?
          AND external_ref IS NOT NULL
        ORDER BY provider_generation DESC LIMIT 1`,
      args: [input.providerId, input.tenantId, input.incidentId],
    });
    return {
      state: 'stale',
      generation: currentGeneration,
      ...(ref.rows[0]?.external_ref ? { externalRef: String(ref.rows[0].external_ref) } : {}),
    };
  }
  if (currentGeneration === input.generation) {
    // Same-generation retries retain the existing active fence.  The
    // operation-specific delivery row decides whether this is a retry or an
    // already completed no-op; it must never fence an in-flight request out.
    if (row?.status === 'active' && String(row.lease_expires_at) > input.now) {
      return {
        state: 'claimed',
        generation: currentGeneration,
        fenceToken: String(row.fence_token),
      };
    }
    const renewed = await tx.execute({
      sql: `UPDATE provider_incident_generations
        SET status = 'active', fence_token = ?, claimed_at = ?,
          lease_expires_at = ?, external_ref = external_ref
        WHERE provider = ? AND tenant_id = ? AND incident_id = ?
          AND generation = ? AND fence_token = ?`,
      args: [
        input.fenceToken,
        input.now,
        input.leaseExpiresAt,
        input.providerId,
        input.tenantId,
        input.incidentId,
        currentGeneration,
        String(row?.fence_token),
      ],
    });
    if (renewed.rowsAffected !== 1) throw new DomainError('CONFLICT');
    return {
      state: 'claimed',
      generation: currentGeneration,
      fenceToken: input.fenceToken,
    };
  }
  if (input.serializeNetworkEffect && row?.status === 'active') {
    if (String(row.lease_expires_at) > input.now) {
      return {
        state: 'busy',
        generation: currentGeneration,
        fenceToken: String(row.fence_token),
      };
    }
    return {
      state: 'reconcile_required',
      generation: currentGeneration,
      fenceToken: String(row.fence_token),
    };
  }
  const moved = await tx.execute({
    sql: `UPDATE provider_incident_generations
      SET generation = ?, fence_token = ?, status = 'active', claimed_at = ?,
        lease_expires_at = ?, external_ref = NULL
      WHERE provider = ? AND tenant_id = ? AND incident_id = ? AND generation = ?
        ${input.serializeNetworkEffect ? "AND status IN ('terminal','reconciled')" : ''}`,
    args: [
      input.generation,
      input.fenceToken,
      input.now,
      input.leaseExpiresAt,
      input.providerId,
      input.tenantId,
      input.incidentId,
      currentGeneration,
    ],
  });
  if (moved.rowsAffected !== 1) throw new DomainError('CONFLICT');
  return {
    state: 'claimed',
    generation: input.generation,
    fenceToken: input.fenceToken,
  };
}

async function providerGenerationFenceCurrent(
  store: OperationalStore,
  input: Readonly<{
    providerId: string;
    tenantId: string;
    incidentId: string;
    generation: number;
    fenceToken: string;
    now: string;
  }>,
): Promise<boolean> {
  const current = await store.execute({
    sql: `SELECT 1 FROM provider_incident_generations
      WHERE provider = ? AND tenant_id = ? AND incident_id = ?
        AND generation = ? AND fence_token = ? AND status = 'active'
        AND lease_expires_at > ?`,
    args: [input.providerId, input.tenantId, input.incidentId, input.generation, input.fenceToken, input.now],
  });
  return current.rows.length === 1;
}

function generationFence(
  row: Readonly<Record<string, unknown>>,
  fenceToken: string | undefined,
): Readonly<{ generation: number; fenceToken: string }> | undefined {
  const generation = Number(row.provider_generation);
  return Number.isSafeInteger(generation) && generation > 0 && fenceToken ? { generation, fenceToken } : undefined;
}

async function terminalizeProviderGeneration(
  store: OperationalStore,
  input: Readonly<{
    providerId: string;
    tenantId: string;
    incidentId: string;
    generation: number;
    fenceToken: string;
    externalRef?: string;
  }>,
): Promise<void> {
  await store.execute({
    sql: `UPDATE provider_incident_generations
      SET status = 'terminal', external_ref = COALESCE(?, external_ref)
      WHERE provider = ? AND tenant_id = ? AND incident_id = ?
        AND generation = ? AND fence_token = ? AND status = 'active'`,
    args: [
      input.externalRef ?? null,
      input.providerId,
      input.tenantId,
      input.incidentId,
      input.generation,
      input.fenceToken,
    ],
  });
}

/**
 * A lease only protects local ownership.  Once it expires, the previous
 * marker must be read from the remote provider before another generation is
 * allowed to mutate the same external incident.  This helper intentionally
 * does not dispatch the waiting generation; a fresh delivery pass observes a
 * terminal/reconciled ledger row and claims it with a new fence.
 */
async function reconcileExpiredProviderGeneration(
  store: OperationalStore,
  provider: IncidentProvider,
  input: Readonly<{
    providerId: string;
    tenantId: string;
    incidentId: string;
    generation: number;
    fenceToken: string;
    now: string;
  }>,
): Promise<void> {
  if (!provider.reconcile) return;
  const delivery = await store.execute({
    sql: `SELECT operation, idempotency_key, external_ref, projection_json
      FROM provider_deliveries
      WHERE provider = ? AND tenant_id = ? AND incident_id = ?
        AND provider_generation = ? AND status IN ('delivering','uncertain')
      ORDER BY attempt_count DESC LIMIT 1`,
    args: [input.providerId, input.tenantId, input.incidentId, input.generation],
  });
  const row = delivery.rows[0];
  if (!row || typeof row.projection_json !== 'string') return;
  let projection: ExternalIncidentProjection;
  try {
    projection = JSON.parse(row.projection_json) as ExternalIncidentProjection;
  } catch {
    throw new DomainError('STORAGE_UNAVAILABLE');
  }
  const result = await provider.reconcile({
    operation: row.operation === 'open-awaiting-approval' ? 'create' : 'update',
    idempotencyKey: String(row.idempotency_key),
    generation: input.generation,
    projection,
    ...(row.external_ref ? { externalRef: String(row.external_ref) } : {}),
  });
  if (!result) return;
  await store.transaction(async tx => {
    // Reconciliation can race only with a stale owner; the exact fence is the
    // decisive CAS and prevents an old delayed response from terminalizing a
    // later generation.
    const reconciled = await tx.execute({
      sql: `UPDATE provider_incident_generations
        SET status = 'reconciled', external_ref = ?
        WHERE provider = ? AND tenant_id = ? AND incident_id = ?
          AND generation = ? AND fence_token = ? AND status = 'active'
          AND lease_expires_at <= ?`,
      args: [
        result.externalRef,
        input.providerId,
        input.tenantId,
        input.incidentId,
        input.generation,
        input.fenceToken,
        input.now,
      ],
    });
    if (reconciled.rowsAffected !== 1) return;
    await tx.execute({
      sql: `UPDATE provider_deliveries SET status = 'succeeded', external_ref = ?,
        error_code = NULL, next_attempt_at = NULL, observed_at = ?
        WHERE provider = ? AND tenant_id = ? AND incident_id = ?
          AND provider_generation = ? AND status IN ('delivering','uncertain')`,
      args: [result.externalRef, input.now, input.providerId, input.tenantId, input.incidentId, input.generation],
    });
  });
}

async function persistDeliveryOutcome(
  store: OperationalStore,
  providerId: string,
  input: Parameters<typeof deliverExternalIncident>[2],
  outcome: Readonly<{
    deliveryId: string;
    expectedAttempt: number;
    expectedState: 'active' | 'delivering';
    status: 'succeeded' | 'retry' | 'exhausted' | 'uncertain';
    nextAttemptAt: string | null;
    externalRef: string | null;
    errorCode: string | null;
    auditStatus: 'succeeded' | 'retry_scheduled' | 'exhausted';
    generationFence?: Readonly<{ generation: number; fenceToken: string }>;
  }>,
  ids: IdGenerator,
  clock: Clock,
): Promise<void> {
  const occurredAt = clock.now();
  await store.transaction(async tx => {
    const updated = await tx.execute({
      sql: `UPDATE provider_deliveries SET status = ?, next_attempt_at = ?,
        external_ref = ?, error_code = ?, observed_at = ? WHERE id = ? AND attempt_count = ?
        AND ${outcome.expectedState === 'delivering' ? "status = 'delivering'" : "status IN ('pending','retry','delivering','uncertain')"}`,
      args: [
        outcome.status,
        outcome.nextAttemptAt,
        outcome.externalRef,
        outcome.errorCode,
        occurredAt,
        outcome.deliveryId,
        outcome.expectedAttempt,
      ],
    });
    if (updated.rowsAffected !== 1) throw new DomainError('CONFLICT');
    const incident = await tx.execute({
      sql: `UPDATE incidents SET timeline_sequence = timeline_sequence + 1,
        updated_at = ? WHERE tenant_id = ? AND id = ? AND updated_at <= ?
        RETURNING timeline_sequence`,
      args: [occurredAt, input.projection.tenantId, input.projection.incidentId, occurredAt],
    });
    if (!incident.rows[0]) throw new DomainError('CONFLICT');
    await tx.execute({
      sql: `INSERT INTO timeline_events(
        id, incident_id, tenant_id, sequence, type, category, correlation_id,
        causation_id, payload_json, schema_version, occurred_at
      ) VALUES (?, ?, ?, ?, 'provider.incident_delivery', 'domain', ?, ?, ?, 1, ?)`,
      args: [
        ids.next(),
        input.projection.incidentId,
        input.projection.tenantId,
        Number(incident.rows[0].timeline_sequence),
        input.correlationId,
        input.workflowRunId,
        JSON.stringify({
          provider: providerId,
          operation: input.operation,
          status: outcome.auditStatus,
          attempt: outcome.expectedAttempt,
          ...(outcome.errorCode ? { errorCode: outcome.errorCode } : {}),
        }),
        occurredAt,
      ],
    });
    if (providerId === 'linear' && outcome.generationFence && outcome.status !== 'uncertain') {
      const closed = await tx.execute({
        sql: `UPDATE provider_incident_generations
          SET status = 'terminal', external_ref = COALESCE(?, external_ref)
          WHERE provider = ? AND tenant_id = ? AND incident_id = ?
            AND generation = ? AND fence_token = ? AND status = 'active'`,
        args: [
          outcome.externalRef,
          providerId,
          input.projection.tenantId,
          input.projection.incidentId,
          outcome.generationFence.generation,
          outcome.generationFence.fenceToken,
        ],
      });
      if (closed.rowsAffected !== 1) throw new DomainError('CONFLICT');
    }
  });
}

class TimeoutError extends Error {}

async function withTimeout<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new TimeoutError()), timeoutMs);
        timer.unref();
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
