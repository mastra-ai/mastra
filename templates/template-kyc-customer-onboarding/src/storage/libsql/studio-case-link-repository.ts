import type { Client } from '@libsql/client';
import { z } from 'zod';

import type { StudioCaseLinkRepository } from '../../contracts/repositories/studio-case-link-repository.js';
import {
  completeStudioCaseLinkInputSchema,
  getStudioCaseLinkByRunInputSchema,
  listActiveStudioCaseLinksInputSchema,
  putStudioCaseLinkInputSchema,
  studioCaseLinkSchema,
} from '../../contracts/repositories/studio-case-link-repository.js';
import { runIdempotentMutation } from './idempotent-mutation.js';
import { NotFoundError } from '../../domain/errors.js';

export class LibSqlStudioCaseLinkRepository implements StudioCaseLinkRepository {
  constructor(private readonly client: Client) {}

  async put(input: Parameters<StudioCaseLinkRepository['put']>[0]) {
    const parsed = putStudioCaseLinkInputSchema.parse(input);
    const mutation = await runIdempotentMutation({
      client: this.client,
      tenantId: parsed.link.tenantId,
      operation: 'PUT_STUDIO_CASE_LINK',
      key: parsed.idempotencyKey,
      requestFingerprint: parsed.requestFingerprint,
      createdAt: parsed.link.createdAt,
      completedAt: parsed.link.updatedAt,
      execute: async transaction => {
        await transaction.execute({
          sql: `INSERT INTO studio_case_links
            (tenant_id,thread_id,case_id,workflow_run_id,status,payload_json,created_at,updated_at)
            VALUES (?,?,?,?,?,?,?,?)`,
          args: [
            parsed.link.tenantId,
            parsed.link.threadId,
            parsed.link.caseId,
            parsed.link.workflowRunId,
            parsed.link.status,
            JSON.stringify(parsed.link),
            parsed.link.createdAt,
            parsed.link.updatedAt,
          ],
        });
        return parsed.link;
      },
      parseResult: value => studioCaseLinkSchema.parse(value),
    });
    return mutation.result;
  }

  async getActive(input: Parameters<StudioCaseLinkRepository['getActive']>[0]) {
    const links = await this.listActive(input);
    return links[0];
  }

  async getByRun(input: Parameters<StudioCaseLinkRepository['getByRun']>[0]) {
    const parsed = getStudioCaseLinkByRunInputSchema.parse(input);
    const result = await this.client.execute({
      sql: 'SELECT payload_json FROM studio_case_links WHERE tenant_id=? AND workflow_run_id=?',
      args: [parsed.tenantId, parsed.workflowRunId],
    });
    const row = result.rows[0];
    if (row === undefined) return undefined;
    return studioCaseLinkSchema.parse(JSON.parse(z.string().parse(row.payload_json)));
  }

  async listActive(input: Parameters<StudioCaseLinkRepository['listActive']>[0]) {
    const parsed = listActiveStudioCaseLinksInputSchema.parse(input);
    const result = await this.client.execute({
      sql: `SELECT payload_json FROM studio_case_links
        WHERE tenant_id=? AND thread_id=? AND status='ACTIVE' ORDER BY created_at,case_id`,
      args: [parsed.tenantId, parsed.threadId],
    });
    return result.rows.map(row => studioCaseLinkSchema.parse(JSON.parse(z.string().parse(row.payload_json))));
  }

  async complete(input: Parameters<StudioCaseLinkRepository['complete']>[0]) {
    const parsed = completeStudioCaseLinkInputSchema.parse(input);
    const current = await this.getByRun({
      tenantId: parsed.tenantId,
      workflowRunId: parsed.workflowRunId,
    });
    if (current === undefined) throw new NotFoundError('Studio case link');
    if (current.status === 'COMPLETED') return current;
    const completed = studioCaseLinkSchema.parse({
      ...current,
      status: 'COMPLETED',
      updatedAt: parsed.completedAt,
    });
    await this.client.execute({
      sql: `UPDATE studio_case_links SET status='COMPLETED',payload_json=?,updated_at=?
        WHERE tenant_id=? AND workflow_run_id=? AND status='ACTIVE'`,
      args: [JSON.stringify(completed), completed.updatedAt, parsed.tenantId, parsed.workflowRunId],
    });
    return completed;
  }
}
