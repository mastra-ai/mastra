import type { Client } from '@libsql/client';

import {
  abandonIdempotencyInputSchema,
  completeIdempotencyInputSchema,
  idempotencyReservationSchema,
  idempotencyRecordSchema,
  reacquireExpiredIdempotencyInputSchema,
  reserveIdempotencyInputSchema,
  type IdempotencyRepository,
} from '../../contracts/repositories/idempotency-repository.js';
import { IdempotencyConflictError, PersistenceConflictError } from '../../domain/errors.js';
import { serializeLibSqlWriter } from './idempotent-mutation.js';

const fromRow = (row: Record<string, unknown>) =>
  idempotencyRecordSchema.parse({
    tenantId: row.tenant_id,
    operation: row.operation,
    key: row.key,
    requestFingerprint: row.request_fingerprint,
    status: row.status,
    resultJson: row.result_json,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  });

export class LibSqlIdempotencyRepository implements IdempotencyRepository {
  constructor(private readonly client: Client) {}

  async reserve(input: Parameters<IdempotencyRepository['reserve']>[0]) {
    const parsed = reserveIdempotencyInputSchema.parse(input);
    return serializeLibSqlWriter(async () => {
      const reservation = await this.#reserve(parsed);
      return idempotencyReservationSchema.parse(reservation);
    });
  }

  async complete(input: Parameters<IdempotencyRepository['complete']>[0]) {
    const parsed = completeIdempotencyInputSchema.parse(input);
    return serializeLibSqlWriter(async () => {
      const { record: existing } = await this.#reserve(parsed);
      if (existing.status === 'COMPLETED') {
        if (existing.resultJson !== parsed.resultJson) throw new IdempotencyConflictError();
        return existing;
      }
      const result = await this.client.execute({
        sql: `UPDATE idempotency_keys SET status = 'COMPLETED', result_json = ?, completed_at = ?
          WHERE tenant_id = ? AND operation = ? AND key = ? AND request_fingerprint = ?
            AND status = 'RESERVED' AND created_at = ?`,
        args: [
          parsed.resultJson,
          parsed.completedAt,
          parsed.tenantId,
          parsed.operation,
          parsed.key,
          parsed.requestFingerprint,
          parsed.createdAt,
        ],
      });
      if (result.rowsAffected !== 1) throw new PersistenceConflictError('Idempotency record');
      return idempotencyRecordSchema.parse({ ...parsed, status: 'COMPLETED' });
    });
  }

  async get(tenantId: string, operation: string, key: string) {
    const result = await this.client.execute({
      sql: 'SELECT * FROM idempotency_keys WHERE tenant_id = ? AND operation = ? AND key = ?',
      args: [tenantId, operation, key],
    });
    return result.rows[0] === undefined ? undefined : fromRow(result.rows[0]);
  }

  async reacquireExpired(input: Parameters<IdempotencyRepository['reacquireExpired']>[0]) {
    const parsed = reacquireExpiredIdempotencyInputSchema.parse(input);
    return serializeLibSqlWriter(async () => {
      const existing = await this.get(parsed.tenantId, parsed.operation, parsed.key);
      if (existing === undefined) return this.#reserve(parsed);
      if (existing.requestFingerprint !== parsed.requestFingerprint) throw new IdempotencyConflictError();
      if (existing.status === 'COMPLETED')
        return idempotencyReservationSchema.parse({ record: existing, acquired: false });
      if (
        new Date(parsed.createdAt).getTime() <= new Date(existing.createdAt).getTime() ||
        new Date(existing.createdAt).getTime() > new Date(parsed.expiredBefore).getTime()
      )
        return idempotencyReservationSchema.parse({ record: existing, acquired: false });
      const result = await this.client.execute({
        sql: `UPDATE idempotency_keys SET created_at = ?
          WHERE tenant_id = ? AND operation = ? AND key = ? AND request_fingerprint = ?
            AND status = 'RESERVED' AND created_at = ?`,
        args: [
          parsed.createdAt,
          parsed.tenantId,
          parsed.operation,
          parsed.key,
          parsed.requestFingerprint,
          existing.createdAt,
        ],
      });
      const record = await this.get(parsed.tenantId, parsed.operation, parsed.key);
      if (record === undefined) throw new PersistenceConflictError('Idempotency record');
      return idempotencyReservationSchema.parse({ record, acquired: result.rowsAffected === 1 });
    });
  }

  async abandon(input: Parameters<IdempotencyRepository['abandon']>[0]) {
    const parsed = abandonIdempotencyInputSchema.parse(input);
    return serializeLibSqlWriter(async () => {
      const result = await this.client.execute({
        sql: `DELETE FROM idempotency_keys
          WHERE tenant_id = ? AND operation = ? AND key = ? AND request_fingerprint = ?
            AND status = 'RESERVED' AND created_at = ?`,
        args: [parsed.tenantId, parsed.operation, parsed.key, parsed.requestFingerprint, parsed.createdAt],
      });
      return result.rowsAffected === 1;
    });
  }

  async #reserve(input: Parameters<IdempotencyRepository['reserve']>[0]) {
    const insertion = await this.client.execute({
      sql: `INSERT OR IGNORE INTO idempotency_keys
        (tenant_id, operation, key, request_fingerprint, status, result_json, created_at, completed_at)
        VALUES (?, ?, ?, ?, 'RESERVED', NULL, ?, NULL)`,
      args: [input.tenantId, input.operation, input.key, input.requestFingerprint, input.createdAt],
    });
    const existing = await this.get(input.tenantId, input.operation, input.key);
    if (existing === undefined) throw new PersistenceConflictError('Idempotency record');
    if (existing.requestFingerprint !== input.requestFingerprint) throw new IdempotencyConflictError();
    return { record: existing, acquired: insertion.rowsAffected === 1 };
  }
}
