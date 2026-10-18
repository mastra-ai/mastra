import type { Client } from '@libsql/client';
import type { DuckDBInstance } from '@duckdb/node-api';
import { z } from 'zod';

import { kycCaseSchema } from '../domain/case.js';
import { caseEventSchema } from '../domain/events.js';

const missingFactSchema = z.object({
  tenant_id: z.string().min(1),
  event_id: z.string().min(1),
  case_id: z.string().min(1),
});
const operationalSourceSchema = z.object({
  event_payload_json: z.string(),
  case_payload_json: z.string(),
});

const reconciliationQueues = new WeakMap<DuckDBInstance, Promise<void>>();

const reconcile = async (operational: Client, analytics: DuckDBInstance): Promise<number> => {
  const connection = await analytics.connect();
  try {
    const missing = await connection.runAndReadAll(
      `SELECT tenant_id,event_id,case_id FROM kyc_case_events
       WHERE jurisdiction IS NULL OR policy_version IS NULL OR case_created_at IS NULL
       ORDER BY tenant_id,event_id`,
    );
    const facts = missing.getRowObjectsJS().map(row => missingFactSchema.parse(row));
    if (facts.length === 0) return 0;

    const updates: Readonly<{
      tenantId: string;
      eventId: string;
      caseId: string;
      jurisdiction: string;
      policyVersion: string;
      caseCreatedAt: string;
    }>[] = [];
    for (const fact of facts) {
      const source = await operational.execute({
        sql: `SELECT events.payload_json AS event_payload_json,
                     cases.payload_json AS case_payload_json
              FROM case_events AS events
              JOIN kyc_cases AS cases
                ON cases.tenant_id=events.tenant_id AND cases.id=events.case_id
              WHERE events.tenant_id=? AND events.id=? AND events.case_id=?`,
        args: [fact.tenant_id, fact.event_id, fact.case_id],
      });
      const row = source.rows[0];
      if (row === undefined) {
        throw new Error('Operational authority for analytics case fact is unavailable');
      }
      const parsed = operationalSourceSchema.parse(row);
      const event = caseEventSchema.parse(JSON.parse(parsed.event_payload_json));
      const caseValue = kycCaseSchema.parse(JSON.parse(parsed.case_payload_json));
      if (
        event.tenantId !== fact.tenant_id ||
        event.id !== fact.event_id ||
        event.caseId !== fact.case_id ||
        caseValue.tenantId !== fact.tenant_id ||
        caseValue.id !== fact.case_id
      ) {
        throw new Error('Analytics case fact does not match its operational authority');
      }
      updates.push({
        tenantId: fact.tenant_id,
        eventId: fact.event_id,
        caseId: fact.case_id,
        jurisdiction: caseValue.jurisdiction,
        policyVersion: event.policy.version,
        caseCreatedAt: caseValue.createdAt,
      });
    }

    if (updates.length === 0) return 0;
    await connection.run('BEGIN TRANSACTION');
    try {
      for (const update of updates) {
        await connection.run(
          `UPDATE kyc_case_events
           SET jurisdiction=coalesce(jurisdiction,?),
               policy_version=coalesce(policy_version,?),
               case_created_at=coalesce(case_created_at,?)
           WHERE tenant_id=? AND event_id=? AND case_id=?`,
          [
            update.jurisdiction,
            update.policyVersion,
            update.caseCreatedAt,
            update.tenantId,
            update.eventId,
            update.caseId,
          ],
        );
      }
      await connection.run('COMMIT');
    } catch (error) {
      await connection.run('ROLLBACK');
      throw error;
    }
    return updates.length;
  } finally {
    connection.closeSync();
  }
};

export const backfillLegacyAnalyticsCaseFacts = (operational: Client, analytics: DuckDBInstance): Promise<number> => {
  let reconciled = 0;
  const previous = reconciliationQueues.get(analytics) ?? Promise.resolve();
  const run = previous.then(async () => {
    reconciled = await reconcile(operational, analytics);
  });
  reconciliationQueues.set(
    analytics,
    run.then(
      () => undefined,
      () => undefined,
    ),
  );
  return run.then(() => reconciled);
};
