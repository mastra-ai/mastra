import type { Client } from '@libsql/client';
import { z } from 'zod';

import type { ApplicationRepository } from '../../contracts/repositories/application-repository.js';
import { putApplicationInputSchema } from '../../contracts/repositories/application-repository.js';
import { applicationSchema } from '../../domain/application.js';
import { NotFoundError, PersistenceConflictError } from '../../domain/errors.js';
import { runIdempotentMutation } from './idempotent-mutation.js';

export class LibSqlApplicationRepository implements ApplicationRepository {
  constructor(private readonly client: Client) {}
  async put(input: Parameters<ApplicationRepository['put']>[0]) {
    const parsed = putApplicationInputSchema.parse(input);
    const mutation = await runIdempotentMutation({
      client: this.client,
      tenantId: parsed.application.tenantId,
      operation: 'PUT_APPLICATION',
      key: parsed.idempotencyKey,
      requestFingerprint: parsed.requestFingerprint,
      createdAt: parsed.application.createdAt,
      completedAt: parsed.application.updatedAt,
      execute: async transaction => {
        const result = await transaction.execute({
          sql: `INSERT INTO applications (tenant_id,id,case_id,version,payload_json,created_at,updated_at)
            VALUES (?,?,?,?,?,?,?) ON CONFLICT(tenant_id,id) DO UPDATE SET version=excluded.version,payload_json=excluded.payload_json,updated_at=excluded.updated_at
            WHERE excluded.version > applications.version`,
          args: [
            parsed.application.tenantId,
            parsed.application.id,
            parsed.application.caseId,
            parsed.application.version,
            JSON.stringify(parsed.application),
            parsed.application.createdAt,
            parsed.application.updatedAt,
          ],
        });
        if (result.rowsAffected !== 1) throw new PersistenceConflictError('Application');
        return parsed.application;
      },
      parseResult: value => applicationSchema.parse(value),
    });
    return mutation.result;
  }
  async get(input: Parameters<ApplicationRepository['get']>[0]) {
    const result = await this.client.execute({
      sql: 'SELECT payload_json FROM applications WHERE tenant_id=? AND id=?',
      args: [input.tenantId, input.applicationId],
    });
    if (result.rows[0] === undefined) throw new NotFoundError('Application');
    return applicationSchema.parse(JSON.parse(z.string().parse(result.rows[0].payload_json)));
  }
}
