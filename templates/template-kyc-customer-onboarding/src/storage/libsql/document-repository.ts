import type { Client } from '@libsql/client';
import { z } from 'zod';

import type { DocumentRepository } from '../../contracts/repositories/document-repository.js';
import { putDocumentInputSchema } from '../../contracts/repositories/document-repository.js';
import { identityDocumentSchema } from '../../domain/documents.js';
import { NotFoundError, PersistenceConflictError } from '../../domain/errors.js';
import { runIdempotentMutation } from './idempotent-mutation.js';

export class LibSqlDocumentRepository implements DocumentRepository {
  constructor(private readonly client: Client) {}
  async put(input: Parameters<DocumentRepository['put']>[0]) {
    const parsed = putDocumentInputSchema.parse(input);
    const mutation = await runIdempotentMutation({
      client: this.client,
      tenantId: parsed.document.tenantId,
      operation: 'PUT_DOCUMENT',
      key: parsed.idempotencyKey,
      requestFingerprint: parsed.requestFingerprint,
      createdAt: parsed.document.createdAt,
      completedAt: parsed.document.updatedAt,
      execute: async transaction => {
        const result = await transaction.execute({
          sql: `INSERT INTO documents (tenant_id,id,case_id,version,payload_json,created_at,updated_at)
            VALUES (?,?,?,?,?,?,?) ON CONFLICT(tenant_id,id) DO UPDATE SET version=excluded.version,payload_json=excluded.payload_json,updated_at=excluded.updated_at
            WHERE excluded.version > documents.version`,
          args: [
            parsed.document.tenantId,
            parsed.document.id,
            parsed.document.caseId,
            parsed.document.version,
            JSON.stringify(parsed.document),
            parsed.document.createdAt,
            parsed.document.updatedAt,
          ],
        });
        if (result.rowsAffected !== 1) throw new PersistenceConflictError('Document');
        return parsed.document;
      },
      parseResult: value => identityDocumentSchema.parse(value),
    });
    return mutation.result;
  }
  async get(input: Parameters<DocumentRepository['get']>[0]) {
    const result = await this.client.execute({
      sql: 'SELECT payload_json FROM documents WHERE tenant_id=? AND id=?',
      args: [input.tenantId, input.documentId],
    });
    if (result.rows[0] === undefined) throw new NotFoundError('Document');
    return identityDocumentSchema.parse(JSON.parse(z.string().parse(result.rows[0].payload_json)));
  }
  async list(input: Parameters<DocumentRepository['list']>[0]) {
    const result = await this.client.execute({
      sql: 'SELECT payload_json FROM documents WHERE tenant_id=? AND case_id=? ORDER BY created_at,id',
      args: [input.tenantId, input.caseId],
    });
    return result.rows.map(row => identityDocumentSchema.parse(JSON.parse(z.string().parse(row.payload_json))));
  }
}
