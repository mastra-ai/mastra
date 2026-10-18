import type { Client } from '@libsql/client';
import { z } from 'zod';

import type { CaseEventRepository } from '../../contracts/repositories/case-event-repository.js';
import { listCaseEventsInputSchema } from '../../contracts/repositories/case-event-repository.js';
import { InvalidCursorError, NotFoundError } from '../../domain/errors.js';
import { caseEventSchema } from '../../domain/events.js';

export class LibSqlCaseEventRepository implements CaseEventRepository {
  constructor(private readonly client: Client) {}
  async get(input: Parameters<CaseEventRepository['get']>[0]) {
    const result = await this.client.execute({
      sql: 'SELECT payload_json FROM case_events WHERE tenant_id=? AND id=?',
      args: [input.tenantId, input.eventId],
    });
    if (result.rows[0] === undefined) throw new NotFoundError('Case event');
    return caseEventSchema.parse(JSON.parse(z.string().parse(result.rows[0].payload_json)));
  }
  async list(rawInput: Parameters<CaseEventRepository['list']>[0]) {
    const input = listCaseEventsInputSchema.parse(rawInput);
    const cursor =
      input.afterEventId === undefined
        ? undefined
        : await this.client.execute({
            sql: 'SELECT case_version FROM case_events WHERE tenant_id=? AND case_id=? AND id=?',
            args: [input.tenantId, input.caseId, input.afterEventId],
          });
    const afterVersion = cursor?.rows[0]?.case_version;
    if (input.afterEventId !== undefined && afterVersion === undefined) {
      throw new InvalidCursorError();
    }
    const result = await this.client.execute({
      sql: `SELECT payload_json FROM case_events WHERE tenant_id=? AND case_id=? AND case_version > ? ORDER BY case_version LIMIT ?`,
      args: [input.tenantId, input.caseId, afterVersion === undefined ? 0 : Number(afterVersion), input.limit],
    });
    return result.rows.map(row => caseEventSchema.parse(JSON.parse(z.string().parse(row.payload_json))));
  }
}
