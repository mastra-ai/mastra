import type { Client } from '@libsql/client';
import { z } from 'zod';

import type { EvidenceRepository } from '../../contracts/repositories/evidence-repository.js';
import { appendEvidenceInputSchema } from '../../contracts/repositories/evidence-repository.js';
import { evidenceItemSchema } from '../../domain/evidence.js';
import { NotFoundError } from '../../domain/errors.js';
import { fingerprintRequest, runIdempotentMutation } from './idempotent-mutation.js';

export class LibSqlEvidenceRepository implements EvidenceRepository {
  constructor(private readonly client: Client) {}
  async append(input: Parameters<EvidenceRepository['append']>[0]) {
    const parsed = appendEvidenceInputSchema.parse(input);
    const mutation = await runIdempotentMutation({
      client: this.client,
      tenantId: parsed.evidence.tenantId,
      operation: 'APPEND_EVIDENCE',
      key: parsed.idempotencyKey,
      requestFingerprint: fingerprintRequest(parsed.evidence),
      createdAt: parsed.evidence.occurredAt,
      completedAt: parsed.evidence.occurredAt,
      execute: async transaction => {
        await transaction.execute({
          sql: 'INSERT INTO evidence_items (tenant_id,id,case_id,payload_json,occurred_at) VALUES (?,?,?,?,?)',
          args: [
            parsed.evidence.tenantId,
            parsed.evidence.id,
            parsed.evidence.caseId,
            JSON.stringify(parsed.evidence),
            parsed.evidence.occurredAt,
          ],
        });
        return parsed.evidence;
      },
      parseResult: value => evidenceItemSchema.parse(value),
    });
    return mutation.result;
  }
  async get(input: Parameters<EvidenceRepository['get']>[0]) {
    const result = await this.client.execute({
      sql: 'SELECT payload_json FROM evidence_items WHERE tenant_id=? AND id=?',
      args: [input.tenantId, input.evidenceId],
    });
    if (result.rows[0] === undefined) throw new NotFoundError('Evidence');
    return evidenceItemSchema.parse(JSON.parse(z.string().parse(result.rows[0].payload_json)));
  }
  async list(input: Parameters<EvidenceRepository['list']>[0]) {
    const result = await this.client.execute({
      sql: 'SELECT payload_json FROM evidence_items WHERE tenant_id=? AND case_id=? ORDER BY occurred_at,id',
      args: [input.tenantId, input.caseId],
    });
    return result.rows.map(row => evidenceItemSchema.parse(JSON.parse(z.string().parse(row.payload_json))));
  }
}
