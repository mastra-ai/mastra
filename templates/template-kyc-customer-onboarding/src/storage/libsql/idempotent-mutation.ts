import { createHash } from 'node:crypto';

import type { Client, Transaction } from '@libsql/client';
import { z } from 'zod';

import { IdempotencyConflictError, PersistenceConflictError } from '../../domain/errors.js';

type IdempotentMutationInput<Result> = Readonly<{
  client: Client;
  tenantId: string;
  operation: string;
  key: string;
  requestFingerprint: string;
  createdAt: string;
  completedAt: string;
  execute: (transaction: Transaction) => Promise<Result>;
  parseResult: (value: unknown) => Result;
}>;

const replayRowSchema = z
  .object({
    request_fingerprint: z.string(),
    status: z.enum(['RESERVED', 'COMPLETED']),
    result_json: z.string().nullable(),
  })
  .strict();

const safeRollback = async (transaction: Transaction): Promise<void> => {
  if (!transaction.closed) await transaction.rollback();
};

const parseCompletedResult = <Result>(resultJson: string, parseResult: (value: unknown) => Result): Result => {
  try {
    return parseResult(JSON.parse(resultJson));
  } catch {
    throw new PersistenceConflictError('Idempotency result');
  }
};

const parseReplayRow = (value: unknown): z.infer<typeof replayRowSchema> => {
  const parsed = replayRowSchema.safeParse(value);
  if (!parsed.success) throw new PersistenceConflictError('Idempotency record');
  return parsed.data;
};

export const fingerprintRequest = (value: unknown): string =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');

let writerQueue = Promise.resolve();

export const serializeLibSqlWriter = async <Result>(operation: () => Promise<Result>): Promise<Result> => {
  const prior = writerQueue;
  let release: () => void = () => undefined;
  writerQueue = new Promise<void>(resolve => {
    release = resolve;
  });
  await prior;
  try {
    return await operation();
  } finally {
    release();
  }
};

const runMutationOnce = async <Result>(
  input: IdempotentMutationInput<Result>,
): Promise<Readonly<{ result: Result; replayed: boolean }>> => {
  const transaction = await input.client.transaction('write');
  try {
    const reservation = await transaction.execute({
      sql: `INSERT OR IGNORE INTO idempotency_keys
        (tenant_id, operation, key, request_fingerprint, status, result_json, created_at, completed_at)
        VALUES (?, ?, ?, ?, 'RESERVED', NULL, ?, NULL)`,
      args: [input.tenantId, input.operation, input.key, input.requestFingerprint, input.createdAt],
    });
    const stored = await transaction.execute({
      sql: `SELECT request_fingerprint, status, result_json FROM idempotency_keys
        WHERE tenant_id = ? AND operation = ? AND key = ?`,
      args: [input.tenantId, input.operation, input.key],
    });
    const row = parseReplayRow(stored.rows[0]);
    if (row.request_fingerprint !== input.requestFingerprint) {
      throw new IdempotencyConflictError();
    }
    if (reservation.rowsAffected === 0) {
      if (row.status !== 'COMPLETED' || row.result_json === null) {
        throw new PersistenceConflictError('Idempotency record');
      }
      const result = parseCompletedResult(row.result_json, input.parseResult);
      await transaction.rollback();
      return { result, replayed: true };
    }

    const result = await input.execute(transaction);
    await transaction.execute({
      sql: `UPDATE idempotency_keys SET status = 'COMPLETED', result_json = ?, completed_at = ?
        WHERE tenant_id = ? AND operation = ? AND key = ?`,
      args: [JSON.stringify(result), input.completedAt, input.tenantId, input.operation, input.key],
    });
    await transaction.commit();
    return { result, replayed: false };
  } catch (error) {
    await safeRollback(transaction);
    throw error;
  }
};

export const runIdempotentMutation = async <Result>(
  input: IdempotentMutationInput<Result>,
): Promise<Readonly<{ result: Result; replayed: boolean }>> => serializeLibSqlWriter(() => runMutationOnce(input));
