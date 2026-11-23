import type { Client } from '@libsql/client';
import { z } from 'zod';

import {
  acquireWebhookReceiptInputSchema,
  acquireWebhookReceiptResultSchema,
  completeWebhookReceiptInputSchema,
  webhookReceiptSchema,
  type WebhookReceiptRepository,
} from '../../contracts/repositories/webhook-receipt-repository.js';
import { DomainInvariantError, IdempotencyConflictError, PersistenceConflictError } from '../../domain/errors.js';
import { serializeLibSqlWriter } from './idempotent-mutation.js';

const parse = (row: Readonly<Record<string, unknown>>) =>
  webhookReceiptSchema.parse({
    tenantId: row.tenant_id,
    endpoint: row.endpoint,
    deliveryId: row.delivery_id,
    idempotencyKey: row.idempotency_key,
    payloadFingerprint: row.payload_fingerprint,
    keyId: row.key_id,
    signedAt: row.signed_at,
    status: row.status,
    leaseExpiresAt: row.lease_expires_at,
    outcome: row.outcome_json === null ? null : (JSON.parse(z.string().parse(row.outcome_json)) as unknown),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });

const assertBinding = (
  receipt: z.infer<typeof webhookReceiptSchema>,
  input: z.infer<typeof acquireWebhookReceiptInputSchema>,
): void => {
  if (
    receipt.deliveryId !== input.deliveryId ||
    receipt.idempotencyKey !== input.idempotencyKey ||
    receipt.payloadFingerprint !== input.payloadFingerprint
  ) {
    throw new IdempotencyConflictError();
  }
};

export class LibSqlWebhookReceiptRepository implements WebhookReceiptRepository {
  constructor(private readonly client: Client) {}

  acquire(input: Parameters<WebhookReceiptRepository['acquire']>[0]) {
    const parsed = acquireWebhookReceiptInputSchema.parse(input);
    return serializeLibSqlWriter(async () => {
      const transaction = await this.client.transaction('write');
      try {
        const existing = await transaction.execute({
          sql: `SELECT * FROM webhook_receipts
            WHERE tenant_id=? AND endpoint=? AND (delivery_id=? OR idempotency_key=?)`,
          args: [parsed.tenantId, parsed.endpoint, parsed.deliveryId, parsed.idempotencyKey],
        });
        if (existing.rows[0] !== undefined) {
          const receipt = parse(existing.rows[0]);
          assertBinding(receipt, parsed);
          if (receipt.status === 'COMPLETED') {
            await transaction.rollback();
            return acquireWebhookReceiptResultSchema.parse({
              receipt,
              acquired: false,
              replayed: true,
            });
          }
          if (receipt.leaseExpiresAt > parsed.acquiredAt) {
            await transaction.rollback();
            return acquireWebhookReceiptResultSchema.parse({
              receipt,
              acquired: false,
              replayed: false,
            });
          }
          const update = await transaction.execute({
            sql: `UPDATE webhook_receipts SET lease_expires_at=?,updated_at=?
              WHERE tenant_id=? AND endpoint=? AND delivery_id=? AND status='PROCESSING' AND lease_expires_at<=?`,
            args: [
              parsed.leaseExpiresAt,
              parsed.acquiredAt,
              parsed.tenantId,
              parsed.endpoint,
              parsed.deliveryId,
              parsed.acquiredAt,
            ],
          });
          if (update.rowsAffected !== 1) throw new PersistenceConflictError('Webhook receipt');
          await transaction.commit();
          return acquireWebhookReceiptResultSchema.parse({
            receipt: {
              ...receipt,
              leaseExpiresAt: parsed.leaseExpiresAt,
              updatedAt: parsed.acquiredAt,
            },
            acquired: true,
            replayed: false,
          });
        }
        await transaction.execute({
          sql: `INSERT INTO webhook_receipts
            (tenant_id,endpoint,delivery_id,idempotency_key,payload_fingerprint,key_id,signed_at,status,lease_expires_at,outcome_json,created_at,updated_at)
            VALUES (?,?,?,?,?,?,?,'PROCESSING',?,NULL,?,?)`,
          args: [
            parsed.tenantId,
            parsed.endpoint,
            parsed.deliveryId,
            parsed.idempotencyKey,
            parsed.payloadFingerprint,
            parsed.keyId,
            parsed.signedAt,
            parsed.leaseExpiresAt,
            parsed.acquiredAt,
            parsed.acquiredAt,
          ],
        });
        const { acquiredAt, ...binding } = parsed;
        const receipt = webhookReceiptSchema.parse({
          ...binding,
          status: 'PROCESSING',
          outcome: null,
          createdAt: acquiredAt,
          updatedAt: acquiredAt,
        });
        await transaction.commit();
        return acquireWebhookReceiptResultSchema.parse({ receipt, acquired: true, replayed: false });
      } catch (error) {
        if (!transaction.closed) await transaction.rollback();
        throw error;
      }
    });
  }

  complete(input: Parameters<WebhookReceiptRepository['complete']>[0]) {
    const parsed = completeWebhookReceiptInputSchema.parse(input);
    return serializeLibSqlWriter(async () => {
      const transaction = await this.client.transaction('write');
      try {
        const stored = await transaction.execute({
          sql: 'SELECT * FROM webhook_receipts WHERE tenant_id=? AND endpoint=? AND delivery_id=?',
          args: [parsed.tenantId, parsed.endpoint, parsed.deliveryId],
        });
        const row = stored.rows[0];
        if (row === undefined) throw new PersistenceConflictError('Webhook receipt');
        const receipt = parse(row);
        if (receipt.payloadFingerprint !== parsed.payloadFingerprint) {
          throw new DomainInvariantError('Webhook completion binding is invalid');
        }
        if (receipt.status === 'COMPLETED') {
          if (JSON.stringify(receipt.outcome) !== JSON.stringify(parsed.outcome)) {
            throw new DomainInvariantError('Webhook completion outcome is immutable');
          }
          await transaction.rollback();
          return receipt;
        }
        const completed = webhookReceiptSchema.parse({
          ...receipt,
          status: 'COMPLETED',
          outcome: parsed.outcome,
          updatedAt: parsed.completedAt,
        });
        const update = await transaction.execute({
          sql: `UPDATE webhook_receipts SET status='COMPLETED',outcome_json=?,updated_at=?
            WHERE tenant_id=? AND endpoint=? AND delivery_id=? AND status='PROCESSING'`,
          args: [
            JSON.stringify(parsed.outcome),
            parsed.completedAt,
            parsed.tenantId,
            parsed.endpoint,
            parsed.deliveryId,
          ],
        });
        if (update.rowsAffected !== 1) throw new PersistenceConflictError('Webhook receipt');
        await transaction.commit();
        return completed;
      } catch (error) {
        if (!transaction.closed) await transaction.rollback();
        throw error;
      }
    });
  }
}
