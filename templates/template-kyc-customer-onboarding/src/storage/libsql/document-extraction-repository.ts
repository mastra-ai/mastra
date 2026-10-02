import type { Client } from '@libsql/client';
import { z } from 'zod';

import type { DocumentExtractionRepository } from '../../contracts/repositories/document-extraction-repository.js';
import {
  persistedDocumentExtractionSchema,
  putDocumentExtractionInputSchema,
} from '../../contracts/repositories/document-extraction-repository.js';
import { NotFoundError } from '../../domain/errors.js';
import { runIdempotentMutation } from './idempotent-mutation.js';

export class LibSqlDocumentExtractionRepository implements DocumentExtractionRepository {
  constructor(private readonly client: Client) {}

  async put(input: Parameters<DocumentExtractionRepository['put']>[0]) {
    const parsed = putDocumentExtractionInputSchema.parse(input);
    const mutation = await runIdempotentMutation({
      client: this.client,
      tenantId: parsed.extraction.tenantId,
      operation: 'PUT_DOCUMENT_EXTRACTION',
      key: parsed.idempotencyKey,
      requestFingerprint: parsed.requestFingerprint,
      createdAt: parsed.extraction.createdAt,
      completedAt: parsed.extraction.createdAt,
      execute: async transaction => {
        await transaction.execute({
          sql: `INSERT INTO document_extractions
            (tenant_id,document_id,case_id,schema_version,provider_id,payload_json,created_at)
            VALUES (?,?,?,?,?,?,?)`,
          args: [
            parsed.extraction.tenantId,
            parsed.extraction.documentId,
            parsed.extraction.caseId,
            parsed.extraction.schemaVersion,
            parsed.extraction.result.provider.providerId,
            JSON.stringify(parsed.extraction),
            parsed.extraction.createdAt,
          ],
        });
        return parsed.extraction;
      },
      parseResult: value => persistedDocumentExtractionSchema.parse(value),
    });
    return mutation.result;
  }

  async get(input: Parameters<DocumentExtractionRepository['get']>[0]) {
    const result = await this.client.execute({
      sql: 'SELECT payload_json FROM document_extractions WHERE tenant_id=? AND document_id=?',
      args: [input.tenantId, input.documentId],
    });
    if (result.rows[0] === undefined) throw new NotFoundError('Document extraction');
    return persistedDocumentExtractionSchema.parse(JSON.parse(z.string().parse(result.rows[0].payload_json)));
  }
}
