import { createStep } from '@mastra/core/workflows';
import { z } from 'zod';

import { createLibSqlOperationalStore } from '../../db/libsql-operational-store.js';
import type { OperationalStore } from '../../db/operational-store.js';
import { FastEmbedRunbookEmbedder, type RunbookEmbedder } from '../knowledge/embeddings.js';
import { retrieveRunbook, type RetrieveRunbookResult } from '../knowledge/retrieve.js';
import { LibSqlRunbookVectorStore, type RunbookVectorStore } from '../knowledge/vector-store.js';
import { IncidentKindSchema } from '../../schemas/incident.js';
import { opaqueId } from '../../schemas/common.js';
import { withinWorkflowBoundary } from '../workflow-trace.js';

export const InvestigationStartedSchema = z
  .object({
    eventId: opaqueId,
    incidentId: opaqueId,
    tenantId: opaqueId,
    alertId: opaqueId,
    correlationId: opaqueId,
    runId: opaqueId,
    duplicate: z.boolean(),
  })
  .strict();

export const RunbookRetrievedSchema = z
  .object({
    runId: opaqueId,
    duplicate: z.boolean(),
    retrievalId: opaqueId,
    runbookId: z.string().regex(/^RB-IDENTITY-00[1-3]$/u),
    version: z.string().regex(/^\d+\.\d+\.\d+$/u),
    generationId: opaqueId,
    citation: z.string().regex(/^\[runbook:RB-IDENTITY-00[1-3]@\d+\.\d+\.\d+\]$/u),
    chunkIds: z.array(z.string().regex(/^rch_[0-9a-f]{64}$/u)).max(20),
  })
  .strict();

export type RetrieveStepDependencies = Readonly<{
  openStore?: () => OperationalStore;
  openVectorStore?: () => RunbookVectorStore;
  embedder?: RunbookEmbedder;
  retrieve?: (
    store: OperationalStore,
    vectorStore: RunbookVectorStore,
    embedder: RunbookEmbedder,
    input: Parameters<typeof retrieveRunbook>[3],
  ) => Promise<RetrieveRunbookResult>;
}>;

export function createRetrieveRunbookStep(dependencies: RetrieveStepDependencies = {}) {
  return createStep({
    id: 'retrieve-runbook',
    description: 'Resolves one eligible runbook generation before semantic retrieval.',
    inputSchema: InvestigationStartedSchema,
    outputSchema: RunbookRetrievedSchema,
    execute: async ({ inputData }) => {
      const store = (dependencies.openStore ?? createLibSqlOperationalStore)();
      let vectorStore: RunbookVectorStore | undefined;
      try {
        vectorStore = (dependencies.openVectorStore ?? (() => new LibSqlRunbookVectorStore()))();
        const result = await store.execute({
          sql: 'SELECT kind FROM incidents WHERE tenant_id = ? AND id = ?',
          args: [inputData.tenantId, inputData.incidentId],
        });
        const kind = IncidentKindSchema.safeParse(result.rows[0]?.kind);
        if (!kind.success) throw new Error('Incident kind is unavailable');
        const retrieve = dependencies.retrieve ?? retrieveRunbook;
        const retrieval = await withinWorkflowBoundary(
          store,
          {
            tenantId: inputData.tenantId,
            incidentId: inputData.incidentId,
            workflowRunId: inputData.runId,
            correlationId: inputData.correlationId,
            boundary: 'retrieval.runbook',
            stepId: 'retrieve-runbook',
            provider: 'runbook-vector-store',
          },
          () =>
            retrieve(store, vectorStore!, dependencies.embedder ?? new FastEmbedRunbookEmbedder(), {
              incidentId: inputData.incidentId,
              tenantId: inputData.tenantId,
              workflowRunId: inputData.runId,
              correlationId: inputData.correlationId,
              incidentKind: kind.data,
              queryText: `identity security incident ${kind.data.replaceAll('_', ' ')}`,
            }),
        );
        // Evaluation authority is derived observability. It must never change
        // the operational retrieval result: older workflow tests and callers
        // can legitimately provide a retrieval double without a durable
        // catalog row. The evaluation report independently fails closed when
        // this snapshot is absent from a real completed workflow.
        await persistSecurityEvalRunbookAuthoritySnapshot(store, inputData, retrieval);
        return {
          runId: inputData.runId,
          duplicate: inputData.duplicate || retrieval.duplicate,
          retrievalId: retrieval.retrievalId,
          runbookId: retrieval.runbookId,
          version: retrieval.version,
          generationId: retrieval.generationId,
          citation: retrieval.citation,
          chunkIds: [...retrieval.chunkIds],
        };
      } finally {
        store.close();
        await vectorStore?.close();
      }
    },
  });
}

async function persistSecurityEvalRunbookAuthoritySnapshot(
  store: OperationalStore,
  input: z.infer<typeof InvestigationStartedSchema>,
  retrieval: RetrieveRunbookResult,
): Promise<void> {
  try {
    // Publish the exact retrieval selected for this workflow run. Eval
    // authority reads this durable projection rather than scanning the
    // catalog, so a different active runbook cannot be substituted later.
    const selected = await store.execute({
      sql: `SELECT source_hash,allowed_actions_json,mandatory_rules_json,generation_id,selected_at FROM runbook_retrievals
            WHERE retrieval_id=? AND tenant_id=? AND incident_id=? AND workflow_run_id=?
              AND runbook_id=? AND version=? AND status='succeeded'`,
      args: [
        retrieval.retrievalId,
        input.tenantId,
        input.incidentId,
        input.runId,
        retrieval.runbookId,
        retrieval.version,
      ],
    });
    const row = selected.rows[0];
    if (
      !row ||
      typeof row.source_hash !== 'string' ||
      typeof row.allowed_actions_json !== 'string' ||
      typeof row.mandatory_rules_json !== 'string' ||
      typeof row.generation_id !== 'string' ||
      typeof row.selected_at !== 'string'
    )
      return;
    const chunkRows = await store.execute({
      sql: `SELECT chunk_id FROM runbook_retrieval_chunks
            WHERE retrieval_id=? AND generation_id=? ORDER BY rank`,
      args: [retrieval.retrievalId, row.generation_id],
    });
    const chunkIds = chunkRows.rows.map(chunk => String(chunk.chunk_id));
    if (
      !chunkIds.length ||
      chunkIds.length !== retrieval.chunkIds.length ||
      chunkIds.some((chunkId, index) => chunkId !== retrieval.chunkIds[index])
    )
      return;
    await store.execute({
      sql: `INSERT INTO runbook_authority_snapshots(
              tenant_id,incident_id,workflow_run_id,runbook_id,version,source_hash,
              selected_at,retrieval_id,generation_id,chunk_ids_json,
              mandatory_rules_json,allowed_actions_json
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
            ON CONFLICT(tenant_id,incident_id,workflow_run_id) DO NOTHING`,
      args: [
        input.tenantId,
        input.incidentId,
        input.runId,
        retrieval.runbookId,
        retrieval.version,
        row.source_hash,
        row.selected_at,
        retrieval.retrievalId,
        row.generation_id,
        JSON.stringify(chunkIds),
        row.mandatory_rules_json,
        row.allowed_actions_json,
      ],
    });
  } catch {
    // Instrumentation is intentionally best-effort at this boundary. The
    // independent reporting gate detects and rejects missing authority.
  }
}
