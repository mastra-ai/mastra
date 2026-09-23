import { afterEach, describe, expect, it, vi } from 'vitest';

import { createIncidentFromAlert } from '../../src/db/incident-operations.js';
import { migrateOperationalStore } from '../../src/db/migrate.js';
import { fixedClock } from '../../src/domain/clock.js';
import { sequenceIdGenerator } from '../../src/domain/id-generator.js';
import { createSecurityIncidentWorkflow } from '../../src/mastra/workflows/security-incident-workflow.js';
import { DeterministicRunbookEmbedder } from '../../src/mastra/knowledge/embeddings.js';
import type { RunbookVectorStore } from '../../src/mastra/knowledge/vector-store.js';
import { makeAlert } from '../fixtures/domain.js';
import { createTempDatabase, type TempDatabase } from '../helpers/temp-libsql.js';

const databases: TempDatabase[] = [];

afterEach(async () => {
  await Promise.all(databases.splice(0).map(database => database.cleanup()));
});

describe('runbook retrieval workflow integration', () => {
  it('permits a non-persisted retrieval double without fabricating Security evaluation authority', async () => {
    const database = await createTempDatabase();
    databases.push(database);
    const setupStore = database.createStore();
    await migrateOperationalStore(setupStore);
    await createIncidentFromAlert(setupStore, makeAlert(), {
      clock: fixedClock('2026-08-27T12:00:00.000Z'),
      ids: sequenceIdGenerator(['incident-1', 'timeline-1', 'outbox-1']),
    });
    setupStore.close();

    const retrieve = vi.fn(async () => ({
      retrievalId: 'retrieval-1',
      runbookId: 'RB-IDENTITY-001',
      version: '1.0.0',
      generationId: 'generation-1',
      citation: '[runbook:RB-IDENTITY-001@1.0.0]',
      chunkIds: [`rch_${'a'.repeat(64)}`],
      duplicate: false,
    }));
    const workflow = createSecurityIncidentWorkflow(
      () => database.createStore(),
      {
        openVectorStore: () => new NoopVectorStore(),
        embedder: new DeterministicRunbookEmbedder(),
        retrieve,
      },
      {
        supervisor: async () => ({
          scopeValidated: true,
          specialists: ['identity', 'endpoint', 'cloud'],
        }),
        identityInvestigator: deterministicInvestigator,
        endpointInvestigator: deterministicInvestigator,
        cloudInvestigator: deterministicInvestigator,
        correlationAnalyst: async ({ candidate }) => candidate,
      },
    );
    const run = await workflow.createRun({ runId: 'outbox-1' });
    const result = await run.start({
      inputData: {
        eventId: 'outbox-1',
        incidentId: 'incident-1',
        tenantId: 'tenant-1',
        alertId: 'alert-1',
        correlationId: 'correlation-1',
      },
    });
    expect(result.status).toBe('success');
    if (result.status === 'success') {
      expect(result.result).toMatchObject({
        status: 'blocked',
        incidentId: 'incident-1',
        reasonCodes: ['INTEGRITY_CHECK_FAILED'],
      });
    }
    expect(retrieve).toHaveBeenCalledOnce();
    const calls = retrieve.mock.calls as unknown[][];
    expect(calls[0]?.[3]).toMatchObject({
      incidentKind: 'unauthorized_privilege_change',
      workflowRunId: 'outbox-1',
    });
    const verification = database.createStore();
    try {
      const row = await verification.execute({
        sql: `SELECT i.status,
          (SELECT count(*) FROM runbook_authority_snapshots) AS authority_rows
          FROM incidents i WHERE i.id = 'incident-1'`,
      });
      // The test double has no durable retrieval/catalog record. It may not
      // manufacture an eval snapshot, and the later triage boundary retains
      // its own fail-closed result without turning the workflow into an error.
      expect(row.rows[0]).toEqual({
        status: 'investigating',
        authority_rows: 0,
      });
    } finally {
      verification.close();
    }
  });
});

const deterministicInvestigator = async (input: { facts: readonly { factToken: string }[] }) => ({
  citedFactTokens: input.facts.map(fact => fact.factToken),
  gaps: [],
  contradictionFlags: [],
});

class NoopVectorStore implements RunbookVectorStore {
  async ensureIndex(): Promise<void> {}
  async upsert(): Promise<void> {}
  async query() {
    return [];
  }
  async describe() {
    return { dimension: 384, count: 0 };
  }
  async deleteIndex(): Promise<void> {}
  async close(): Promise<void> {}
}
