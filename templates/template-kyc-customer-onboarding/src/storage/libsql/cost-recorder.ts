import type { Client } from '@libsql/client';

import { costRecordSchema, type CostRecorder } from '../../contracts/technical/primitives.js';

export class LibSqlCostRecorder implements CostRecorder {
  constructor(private readonly client: Client) {}
  async record(input: Parameters<CostRecorder['record']>[0]) {
    const parsed = costRecordSchema.parse(input);
    await this.client.batch(
      [
        {
          sql: 'INSERT OR IGNORE INTO provider_cost_records (tenant_id,usage_event_id,provider_id,payload_json,recorded_at) VALUES (?,?,?,?,?)',
          args: [parsed.tenantId, parsed.usageEventId, parsed.providerId, JSON.stringify(parsed), parsed.recordedAt],
        },
        {
          sql: `INSERT OR IGNORE INTO analytics_outbox
            (tenant_id,event_id,event_type,payload_json,created_at,projected_at)
            VALUES (?,?, 'PROVIDER_USAGE_RECORDED', ?, ?, NULL)`,
          args: [
            parsed.tenantId,
            `provider:${parsed.usageEventId}`,
            JSON.stringify({
              kind: 'provider',
              caseId: parsed.caseId,
              providerId: parsed.providerId,
              operation: parsed.operation,
              outcome: 'success',
              latencyMs: parsed.latencyMs ?? null,
              attemptCount: parsed.attemptCount ?? 1,
              retryCount: parsed.retryCount ?? 0,
              inputUnits: parsed.inputUnits,
              outputUnits: parsed.outputUnits,
              costUsd: parsed.priceVersion.startsWith('unpriced-') ? null : parsed.estimatedCostUsd,
              priceVersion: parsed.priceVersion,
            }),
            parsed.recordedAt,
          ],
        },
      ],
      'write',
    );
    return parsed;
  }
}
