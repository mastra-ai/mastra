import { join } from 'node:path';
import { securityEvalDatasetDirectory } from './dataset-loader.js';

import type { OperationalStore } from '../../db/operational-store.js';
import type { SecurityEvalInput } from './dataset-contract.js';
import { securityEvalActionForInput, securityEvalPlanHash } from './authority-bindings.js';
import { aggregateChunks, chunkRunbook, type PreparedChunk } from '../knowledge/chunker.js';
import { sha256 } from '../knowledge/hashes.js';
import { loadRunbooks, type LoadedRunbook } from '../knowledge/loader.js';

type PreparedAuthorityRunbook = Readonly<{
  runbook: LoadedRunbook;
  generationId: string;
  indexName: string;
  chunks: readonly PreparedChunk[];
  selectedChunks: readonly PreparedChunk[];
}>;

/**
 * Materialises an isolated reference corpus for the approved
 * offline runner.  This is intentionally a domain boundary: every authority
 * fact subsequently consumed by scorers is read back from LibSQL.  Expected
 * labels and observed payload fields are never inputs to this operation.
 */
export async function seedSecurityEvalAuthorityFromInputs(
  store: OperationalStore,
  inputs: readonly SecurityEvalInput[],
  recordedAt: string,
): Promise<void> {
  // The offline corpus uses the exact parser/chunker that produces the
  // operational catalog.  The reader intentionally refuses a standalone
  // Security evaluation snapshot, so fixtures must be a real retrieval projection too.
  const runbooks = new Map(
    (await loadRunbooks(join(securityEvalDatasetDirectory, 'runbooks'))).map(
      runbook => [runbook.metadata.id, runbook] as const,
    ),
  );
  const prepared = new Map<string, PreparedAuthorityRunbook>();
  for (const input of inputs) {
    const fixture = input.fixture;
    const safe =
      fixture.evidence.state === 'complete' &&
      fixture.evidence.scope === 'same-run' &&
      fixture.runbook.availability === 'present' &&
      fixture.runbook.active &&
      fixture.runbook.version === '1.0.0' &&
      fixture.approval === 'approved' &&
      fixture.plan.request === 'runbook-operation' &&
      fixture.plan.target === 'matched' &&
      fixture.plan.hash === 'fresh' &&
      fixture.containment === 'executed-verified';
    if (!safe) continue;
    const runbook = runbooks.get(fixture.runbook.id);
    if (!runbook || runbook.metadata.version !== fixture.runbook.version || runbook.sourceHash !== fixture.runbook.hash)
      throw new Error('SECURITY_EVAL_RUNBOOK_FIXTURE_IDENTITY_MISMATCH');
    const generationId = `offline-generation-${input.caseId}`;
    const chunks = await chunkRunbook(runbook, {
      generationId,
      indexName: `rb_security_eval_${input.caseId.replaceAll('-', '_')}`,
    });
    const selectedChunks = chunks.slice(0, 3);
    if (!selectedChunks.length) throw new Error('SECURITY_EVAL_RUNBOOK_CHUNKS_MISSING');
    prepared.set(
      input.caseId,
      Object.freeze({
        runbook,
        generationId,
        indexName: `rb_security_eval_${input.caseId.replaceAll('-', '_')}`,
        chunks,
        selectedChunks,
      }),
    );
  }
  await store.transaction(async tx => {
    for (const input of inputs) {
      const fixture = input.fixture;
      const runId = `offline-${input.caseId}`;
      const action = securityEvalActionForInput(input);
      const target = `target-${input.caseId}`;
      const planId = `plan-${input.caseId}`;
      const approvalId = `approval-${input.caseId}`;
      const actionId = `effect-${input.caseId}`;
      const safe =
        fixture.evidence.state === 'complete' &&
        fixture.evidence.scope === 'same-run' &&
        fixture.runbook.availability === 'present' &&
        fixture.runbook.active &&
        fixture.runbook.version === '1.0.0' &&
        fixture.approval === 'approved' &&
        fixture.plan.request === 'runbook-operation' &&
        fixture.plan.target === 'matched' &&
        fixture.plan.hash === 'fresh' &&
        fixture.containment === 'executed-verified';

      await tx.execute({
        sql: `INSERT INTO incidents(id,tenant_id,kind,subject_id,status,version,timeline_sequence,created_at,updated_at)
          VALUES (?,?,?,?, 'contained',0,0,?,?)`,
        args: [
          fixture.incidentAlias,
          fixture.tenantAlias,
          fixture.alert.kind,
          `subject-${input.caseId}`,
          recordedAt,
          recordedAt,
        ],
      });
      await tx.execute({
        sql: `INSERT INTO workflow_runs(id,incident_id,tenant_id,run_id,workflow_id,status,started_at,finished_at)
          VALUES (?,?,?,?, 'security-eval-offline-authority','completed',?,?)`,
        args: [runId, fixture.incidentAlias, fixture.tenantAlias, runId, recordedAt, recordedAt],
      });
      if (safe) {
        const authority = prepared.get(input.caseId);
        if (!authority) throw new Error('SECURITY_EVAL_RUNBOOK_AUTHORITY_MISSING');
        const { runbook, generationId, indexName, chunks, selectedChunks } = authority;
        const retrievalId = `offline-retrieval-${input.caseId}`;
        const mandatoryRules = runbook.metadata.mandatoryRules;
        const allowedActions = runbook.allowedActions;
        await tx.execute({
          sql: `INSERT OR IGNORE INTO runbook_versions(runbook_id,version,owner,declared_status,source_path,source_hash,parsed_hash,schema_version,chunking_algorithm_version,embedding_provider,embedding_model,embedding_dimension,allowed_actions_json,mandatory_rules_json,created_at)
            VALUES (?,?, 'security','active',?,?,?,1,1,'fastembed','bge-small-en-v1.5',384,?,?,?)`,
          args: [
            runbook.metadata.id,
            runbook.metadata.version,
            runbook.sourcePath,
            runbook.sourceHash,
            runbook.parsedHash,
            JSON.stringify(allowedActions),
            JSON.stringify(mandatoryRules),
            recordedAt,
          ],
        });
        await tx.execute({
          sql: `INSERT INTO runbook_generations(generation_id,runbook_id,version,incident_kind,index_name,state,chunk_count,aggregate_hash,created_at,activated_at)
            VALUES (?,?,?,?,?,'active',?,?,?,?)`,
          args: [
            generationId,
            runbook.metadata.id,
            runbook.metadata.version,
            runbook.metadata.incidentKinds[0]!,
            indexName,
            chunks.length,
            aggregateChunks(chunks),
            recordedAt,
            recordedAt,
          ],
        });
        for (const chunk of chunks) {
          await tx.execute({
            sql: `INSERT INTO runbook_chunks(generation_id,chunk_id,vector_id,runbook_id,version,incident_kind,section_key,section_ordinal,chunk_ordinal,text,content_hash,metadata_hash,metadata_json,indexed_at)
              VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            args: [
              generationId,
              chunk.id,
              chunk.metadata.vectorId,
              runbook.metadata.id,
              runbook.metadata.version,
              runbook.metadata.incidentKinds[0]!,
              chunk.metadata.sectionKey,
              chunk.metadata.sectionOrdinal,
              chunk.metadata.chunkOrdinal,
              chunk.text,
              chunk.metadata.contentHash,
              chunk.metadata.metadataHash,
              JSON.stringify(chunk.metadata),
              recordedAt,
            ],
          });
        }
        await tx.execute({
          sql: `INSERT INTO runbook_retrievals(retrieval_id,tenant_id,incident_id,workflow_run_id,correlation_id,incident_kind,runbook_id,version,generation_id,index_name,activation_revision,source_hash,generation_aggregate_hash,allowed_actions_json,mandatory_rules_json,citation,query_hash,status,error_code,attempt,lease_token,lease_expires_at,threshold,top_k,policy_version,selected_at,finished_at,selection_integrity_hash,aggregate_integrity_hash)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'succeeded',NULL,1,NULL,NULL,?,3,1,?,?,?,?)`,
          args: [
            retrievalId,
            fixture.tenantAlias,
            fixture.incidentAlias,
            runId,
            `offline-correlation-${input.caseId}`,
            runbook.metadata.incidentKinds[0]!,
            runbook.metadata.id,
            runbook.metadata.version,
            generationId,
            indexName,
            1,
            runbook.sourceHash,
            aggregateChunks(chunks),
            JSON.stringify(allowedActions),
            JSON.stringify(mandatoryRules),
            `[runbook:${runbook.metadata.id}@${runbook.metadata.version}]`,
            sha256(`security-eval-offline\0${input.caseId}`),
            '0.15',
            recordedAt,
            recordedAt,
            sha256(`offline-selection\0${input.caseId}`),
            sha256(`offline-result\0${input.caseId}`),
          ],
        });
        for (const [index, chunk] of selectedChunks.entries()) {
          await tx.execute({
            sql: `INSERT INTO runbook_retrieval_chunks(retrieval_id,rank,generation_id,chunk_id,vector_id,content_hash,metadata_hash,score_text,score,section_ordinal,chunk_ordinal)
              VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
            args: [
              retrievalId,
              index + 1,
              generationId,
              chunk.id,
              chunk.metadata.vectorId,
              chunk.metadata.contentHash,
              chunk.metadata.metadataHash,
              String(1 - index / 10),
              1 - index / 10,
              chunk.metadata.sectionOrdinal,
              chunk.metadata.chunkOrdinal,
            ],
          });
        }
        await tx.execute({
          sql: `INSERT INTO evidence_items(id,incident_id,tenant_id,source,provider,observed_at,collected_at,fact_json,confidence,raw_payload_ref,integrity_hash,sensitivity,incomplete,error_code,hash_version,workflow_run_id)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,'confidential',0,NULL,1,?)`,
          args: [
            fixture.evidence.reference,
            fixture.incidentAlias,
            fixture.tenantAlias,
            fixture.facts[0]!.source,
            fixture.facts[0]!.provider,
            recordedAt,
            recordedAt,
            JSON.stringify({ semanticKey: `security-eval-${input.caseId}` }),
            1,
            `protected:security-eval:${input.caseId}`,
            fixture.evidence.hash,
            runId,
          ],
        });
        const planHash = securityEvalPlanHash(input, action, target);
        await tx.execute({
          sql: `INSERT INTO containment_plans(id,incident_id,tenant_id,schema_version,plan_version,plan_hash_version,plan_hash,plan_json,expires_at,created_at)
            VALUES (?,?,?,?,1,1,?,?,?,?)`,
          args: [
            planId,
            fixture.incidentAlias,
            fixture.tenantAlias,
            1,
            planHash,
            JSON.stringify({ planId, action, target }),
            '2026-08-30T00:30:00.000Z',
            recordedAt,
          ],
        });
        await tx.execute({
          sql: `INSERT INTO runbook_authority_snapshots(tenant_id,incident_id,workflow_run_id,runbook_id,version,source_hash,selected_at,retrieval_id,generation_id,chunk_ids_json,mandatory_rules_json,allowed_actions_json)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
          args: [
            fixture.tenantAlias,
            fixture.incidentAlias,
            runId,
            fixture.runbook.id,
            fixture.runbook.version,
            runbook.sourceHash,
            recordedAt,
            retrievalId,
            generationId,
            JSON.stringify(selectedChunks.map(chunk => chunk.id)),
            JSON.stringify(mandatoryRules),
            JSON.stringify(allowedActions),
          ],
        });
        await tx.execute({
          sql: `INSERT INTO containment_actions(id,plan_id,incident_id,tenant_id,action_id,action_type,target_id,ordinal,input_json,idempotency_key,status)
            VALUES (?,?,?,?,?,?,?,0,'{}',?,'completed')`,
          args: [
            actionId,
            planId,
            fixture.incidentAlias,
            fixture.tenantAlias,
            actionId,
            action,
            target,
            `${planId}:${actionId}`,
          ],
        });
        await tx.execute({
          sql: `INSERT INTO approvals(id,plan_id,incident_id,tenant_id,plan_hash_version,plan_hash,requested_at,expires_at,decision,decided_by,decided_by_role,decision_reason,decided_at,workflow_run_id)
            VALUES (?,?,?,?,1,?,?,?,'approved','security-eval-reviewer','soc_manager','offline-approved',?,?)`,
          args: [
            approvalId,
            planId,
            fixture.incidentAlias,
            fixture.tenantAlias,
            planHash,
            recordedAt,
            '2026-08-30T00:30:00.000Z',
            recordedAt,
            runId,
          ],
        });
        await tx.execute({
          sql: `INSERT INTO local_containment_effects(tenant_id,incident_id,plan_id,action_id,action_type,target_id,input_json,attempt,fence_token,provider_ref,applied_at)
            VALUES (?,?,?,?,?,?, '{}',1,?,?,?)`,
          args: [
            fixture.tenantAlias,
            fixture.incidentAlias,
            planId,
            actionId,
            action,
            target,
            `fence-${input.caseId}`,
            `local-effect-${input.caseId}`,
            recordedAt,
          ],
        });
      }
    }
  });
}
