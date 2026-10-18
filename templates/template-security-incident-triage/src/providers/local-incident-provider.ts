import { DomainError } from '../domain/errors.js';
import type { OperationalStore } from '../db/operational-store.js';
import {
  ExternalIncidentSupersededError,
  ExternalIncidentProjectionSchema,
  type ExternalIncidentProjection,
  type ExternalIncidentResult,
  type IncidentProvider,
} from './incident-provider.js';

export class LocalIncidentProvider implements IncidentProvider {
  readonly providerId = 'local-incident' as const;
  readonly calls: Array<
    Readonly<{
      operation: 'create' | 'update';
      projection: ExternalIncidentProjection;
      idempotencyKey: string;
      generation: number;
    }>
  > = [];
  private readonly results = new Map<
    string,
    Readonly<{
      operation: 'create' | 'update';
      projectionJson: string;
      tenantId: string;
      incidentId: string;
      generation: number;
      result: ExternalIncidentResult;
    }>
  >();
  private readonly inFlight = new Map<string, Promise<ExternalIncidentResult>>();
  private failuresRemaining: number;
  private readonly rejectUpdateReadback: boolean;
  private ambiguitiesRemaining: number;
  private readonly store?: OperationalStore;
  private readonly openStore?: () => OperationalStore;
  private readonly beforePersist?: (
    input: Readonly<{
      operation: 'create' | 'update';
      projection: ExternalIncidentProjection;
      idempotencyKey: string;
      generation: number;
    }>,
  ) => Promise<void> | void;
  private readonly responseMarker?: string;
  private readonly onResponseMarkerConsumed?: () => void;

  constructor(
    options: Readonly<{
      failAttempts?: number;
      /** Hermetic fake of a remote update that cannot be verified on readback. */
      rejectUpdateReadback?: boolean;
      /** Simulates an effect persisted before the provider response is lost. */
      ambiguousAfterPersistAttempts?: number;
      store?: OperationalStore;
      openStore?: () => OperationalStore;
      beforePersist?: (
        input: Readonly<{
          operation: 'create' | 'update';
          projection: ExternalIncidentProjection;
          idempotencyKey: string;
          generation: number;
        }>,
      ) => Promise<void> | void;
      /** Test-only response entropy; it is hashed before a provider result. */
      responseMarker?: string;
      onResponseMarkerConsumed?: () => void;
    }> = {},
  ) {
    if (options.store && options.openStore) throw new DomainError('CONFLICT');
    this.failuresRemaining = options.failAttempts ?? 0;
    this.rejectUpdateReadback = options.rejectUpdateReadback ?? false;
    this.ambiguitiesRemaining = options.ambiguousAfterPersistAttempts ?? 0;
    this.store = options.store;
    this.openStore = options.openStore;
    this.beforePersist = options.beforePersist;
    this.responseMarker = options.responseMarker;
    this.onResponseMarkerConsumed = options.onResponseMarkerConsumed;
  }

  async create(input: {
    projection: ExternalIncidentProjection;
    idempotencyKey: string;
    generation: number;
  }): Promise<ExternalIncidentResult> {
    return this.singleFlight('create', input);
  }

  async update(input: {
    externalRef: string;
    projection: ExternalIncidentProjection;
    idempotencyKey: string;
    generation: number;
  }): Promise<ExternalIncidentResult> {
    if (!/^local-incident-[a-f0-9]{16}$/u.test(input.externalRef)) {
      throw new DomainError('VALIDATION_FAILED');
    }
    return this.singleFlight('update', input);
  }

  /**
   * The local adapter has the same read-only reconciliation seam as Linear. This is
   * intentionally a lookup of the persisted/idempotent result, never another
   * delivery attempt, so contract matrices can observe recovery symmetrically.
   */
  async reconcile(input: {
    operation: 'create' | 'update';
    idempotencyKey: string;
    externalRef?: string;
    generation?: number;
    projection?: ExternalIncidentProjection;
  }): Promise<ExternalIncidentResult | undefined> {
    if (input.operation === 'update' && !input.externalRef) return undefined;
    if (input.generation === undefined || !input.projection) return undefined;
    if (this.store || this.openStore) {
      return this.readPersistedEffect(
        input.operation,
        input.idempotencyKey,
        input.generation,
        ExternalIncidentProjectionSchema.parse(input.projection),
        JSON.stringify(input.projection),
      );
    }
    const saved = this.results.get(input.idempotencyKey);
    if (
      !saved ||
      saved.operation !== input.operation ||
      saved.generation !== input.generation ||
      saved.projectionJson !== JSON.stringify(input.projection) ||
      (input.externalRef !== undefined && saved.result.externalRef !== input.externalRef)
    )
      return undefined;
    return saved.result;
  }

  private singleFlight(
    operation: 'create' | 'update',
    input: {
      projection: ExternalIncidentProjection;
      idempotencyKey: string;
      generation: number;
    },
  ): Promise<ExternalIncidentResult> {
    const key = `${operation}\u0000${input.idempotencyKey}\u0000${input.generation}`;
    const existing = this.inFlight.get(key);
    if (existing) return existing;
    const pending = this.deliver(operation, input).finally(() => {
      this.inFlight.delete(key);
    });
    this.inFlight.set(key, pending);
    return pending;
  }

  private async deliver(
    operation: 'create' | 'update',
    input: {
      projection: ExternalIncidentProjection;
      idempotencyKey: string;
      generation: number;
    },
  ): Promise<ExternalIncidentResult> {
    const projection = ExternalIncidentProjectionSchema.parse(input.projection);
    if (!Number.isSafeInteger(input.generation) || input.generation <= 0) {
      throw new DomainError('VALIDATION_FAILED');
    }
    const projectionJson = JSON.stringify(projection);
    if (this.store || this.openStore) {
      const persisted = await this.readPersistedEffect(
        operation,
        input.idempotencyKey,
        input.generation,
        projection,
        projectionJson,
      );
      if (persisted) return persisted;
    } else {
      const latestGeneration = this.latestGeneration(projection);
      if (latestGeneration > input.generation) {
        throw new ExternalIncidentSupersededError();
      }
      const existing = this.results.get(input.idempotencyKey);
      if (existing) {
        if (
          existing.operation !== operation ||
          existing.generation !== input.generation ||
          existing.projectionJson !== projectionJson
        ) {
          throw new DomainError('CONFLICT');
        }
        return existing.result;
      }
    }
    if (this.failuresRemaining > 0) {
      this.failuresRemaining -= 1;
      this.calls.push({
        operation,
        projection,
        idempotencyKey: input.idempotencyKey,
        generation: input.generation,
      });
      throw new DomainError('STORAGE_UNAVAILABLE', { retryable: true });
    }
    if (operation === 'update' && this.rejectUpdateReadback) {
      this.calls.push({
        operation,
        projection,
        idempotencyKey: input.idempotencyKey,
        generation: input.generation,
      });
      throw new DomainError('CONFLICT');
    }
    if (this.responseMarker) this.onResponseMarkerConsumed?.();
    const ref = `local-incident-${simpleHash(`${input.idempotencyKey}\0${this.responseMarker ?? ''}`)}`;
    const result = Object.freeze({ externalRef: ref });
    await this.beforePersist?.({
      operation,
      projection,
      idempotencyKey: input.idempotencyKey,
      generation: input.generation,
    });
    if (this.store || this.openStore) {
      return this.persistEffect(operation, input.idempotencyKey, input.generation, projection, projectionJson, result);
    }
    const latestGeneration = this.latestGeneration(projection);
    if (latestGeneration > input.generation) {
      throw new ExternalIncidentSupersededError();
    }
    if (latestGeneration === input.generation && latestGeneration !== 0) {
      throw new DomainError('CONFLICT');
    }
    this.calls.push({
      operation,
      projection,
      idempotencyKey: input.idempotencyKey,
      generation: input.generation,
    });
    this.results.set(input.idempotencyKey, {
      operation,
      projectionJson,
      tenantId: projection.tenantId,
      incidentId: projection.incidentId,
      generation: input.generation,
      result,
    });
    if (this.ambiguitiesRemaining > 0) {
      this.ambiguitiesRemaining -= 1;
      throw new DomainError('STORAGE_UNAVAILABLE', { retryable: true });
    }
    return result;
  }

  private latestGeneration(projection: ExternalIncidentProjection): number {
    let latest = 0;
    for (const entry of this.results.values()) {
      if (entry.tenantId === projection.tenantId && entry.incidentId === projection.incidentId) {
        latest = Math.max(latest, entry.generation);
      }
    }
    return latest;
  }

  private async readPersistedEffect(
    operation: 'create' | 'update',
    idempotencyKey: string,
    generation: number,
    projection: ExternalIncidentProjection,
    projectionJson: string,
  ): Promise<ExternalIncidentResult | undefined> {
    const store = this.store ?? this.openStore!();
    try {
      const result = await store.execute({
        sql: `SELECT effect.operation, effect.tenant_id, effect.incident_id,
          effect.generation, effect.projection_json, effect.external_ref,
          (SELECT max(latest.generation) FROM local_incident_provider_effects latest
            WHERE latest.tenant_id = effect.tenant_id
              AND latest.incident_id = effect.incident_id) AS latest_generation
          FROM local_incident_provider_effects effect
          WHERE effect.idempotency_key = ?`,
        args: [idempotencyKey],
      });
      const row = result.rows[0];
      if (!row) return undefined;
      if (Number(row.latest_generation) > generation) {
        throw new ExternalIncidentSupersededError();
      }
      if (
        row.operation !== operation ||
        Number(row.generation) !== generation ||
        row.tenant_id !== projection.tenantId ||
        row.incident_id !== projection.incidentId ||
        row.projection_json !== projectionJson
      ) {
        throw new DomainError('CONFLICT');
      }
      return Object.freeze({ externalRef: String(row.external_ref) });
    } finally {
      if (!this.store) store.close();
    }
  }

  private async persistEffect(
    operation: 'create' | 'update',
    idempotencyKey: string,
    generation: number,
    projection: ExternalIncidentProjection,
    projectionJson: string,
    result: ExternalIncidentResult,
  ): Promise<ExternalIncidentResult> {
    const store = this.store ?? this.openStore!();
    try {
      let inserted = false;
      const outcome = await store.transaction(async tx => {
        const latest = await tx.execute({
          sql: `SELECT max(generation) AS generation
            FROM local_incident_provider_effects
            WHERE tenant_id = ? AND incident_id = ?`,
          args: [projection.tenantId, projection.incidentId],
        });
        const latestGeneration = Number(latest.rows[0]?.generation ?? 0);
        if (latestGeneration > generation) {
          return { state: 'superseded' as const };
        }
        if (latestGeneration === generation && latestGeneration !== 0) {
          const concurrent = await tx.execute({
            sql: `SELECT operation, tenant_id, incident_id, generation, projection_json,
              external_ref FROM local_incident_provider_effects
              WHERE idempotency_key = ?`,
            args: [idempotencyKey],
          });
          return concurrent.rows[0]
            ? { state: 'persisted' as const, row: concurrent.rows[0] }
            : { state: 'conflict' as const };
        }
        const created = await tx.execute({
          sql: `INSERT OR IGNORE INTO local_incident_provider_effects(
            idempotency_key, operation, tenant_id, incident_id, generation,
            projection_json, external_ref
          ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          args: [
            idempotencyKey,
            operation,
            projection.tenantId,
            projection.incidentId,
            generation,
            projectionJson,
            result.externalRef,
          ],
        });
        inserted = created.rowsAffected === 1;
        const current = await tx.execute({
          sql: `SELECT operation, tenant_id, incident_id, generation, projection_json,
            external_ref FROM local_incident_provider_effects
            WHERE idempotency_key = ?`,
          args: [idempotencyKey],
        });
        return { state: 'persisted' as const, row: current.rows[0] };
      });
      if (outcome.state === 'superseded') {
        throw new ExternalIncidentSupersededError();
      }
      if (outcome.state === 'conflict') throw new DomainError('CONFLICT');
      const persisted = outcome.row;
      if (
        !persisted ||
        persisted.operation !== operation ||
        Number(persisted.generation) !== generation ||
        persisted.tenant_id !== projection.tenantId ||
        persisted.incident_id !== projection.incidentId ||
        persisted.projection_json !== projectionJson ||
        persisted.external_ref !== result.externalRef
      ) {
        throw new DomainError('CONFLICT');
      }
      if (inserted) {
        this.calls.push({ operation, projection, idempotencyKey, generation });
      }
      return Object.freeze({ externalRef: String(persisted.external_ref) });
    } finally {
      if (!this.store) store.close();
    }
  }
}

function simpleHash(value: string): string {
  let state = 0xcbf29ce484222325n;
  for (const byte of new TextEncoder().encode(value)) {
    state ^= BigInt(byte);
    state = BigInt.asUintN(64, state * 0x100000001b3n);
  }
  return state.toString(16).padStart(16, '0');
}
