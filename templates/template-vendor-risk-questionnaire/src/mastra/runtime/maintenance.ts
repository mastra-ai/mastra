import { chmod, lstat, readdir, readFile, rm } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { z } from 'zod';
import { openDatabase } from '../persistence/database.ts';
import { writeTransaction } from '../persistence/transaction.ts';
import { openReviewStore } from '../persistence/review.ts';
import { reviewStateSchema, scopedRunId } from '../contracts/review.ts';
import { hash } from '../contracts/primitives.ts';
import { canonicalJson, sha256 } from '../intake/source.ts';
import { telemetryId } from '../observability/privacy.ts';
import { containedDirectory } from '../exports/publication.ts';
import type { MastraStorage } from '@mastra/core/storage';
import type { Client } from '@libsql/client';
import type { createQuestionnaireWorkflow } from '../workflows/vendor-risk-questionnaire.ts';

export const cleanupConfirmationSchema = z
  .object({ runId: scopedRunId, revision: z.int().nonnegative(), previewDigest: hash, confirm: z.literal(true) })
  .strict();
const tables = [
  'vrq_events',
  'vrq_diagnostics',
  'vrq_decisions',
  'vrq_review',
  'vrq_security',
  'vrq_usage',
  'vrq_results',
  'vrq_processing',
  'vrq_evidence_snapshots',
  'vrq_intakes',
  'vrq_document_plans',
  'vrq_respond',
  'vrq_http_jobs',
  'vrq_draft_owners',
  'vrq_review_payloads',
  'vrq_draft_inputs',
  'vrq_interpretations',
  'vrq_consistency',
  'vrq_questionnaire_lifecycle',
] as const;
const partition = (table: string, runId: string) => (table === 'vrq_diagnostics' ? telemetryId(runId)! : runId);
// Source bytes are content-addressed and may be shared by questionnaires and evidence
// across runs. Only collect this run's sources when no other run still references them.
const cleanableSources = `SELECT s.* FROM vrq_sources s
  WHERE (EXISTS (SELECT 1 FROM vrq_intakes i WHERE i.run_id = ? AND i.source_digest = s.digest)
    OR EXISTS (SELECT 1 FROM vrq_evidence_snapshots e, json_each(e.snapshot_json, '$.documents') d
      WHERE e.run_id = ? AND json_extract(d.value, '$.sha256') = s.digest))
  AND NOT EXISTS (SELECT 1 FROM vrq_intakes i WHERE i.run_id <> ? AND i.source_digest = s.digest)
  AND NOT EXISTS (SELECT 1 FROM vrq_evidence_snapshots e, json_each(e.snapshot_json, '$.documents') d
    WHERE e.run_id <> ? AND json_extract(d.value, '$.sha256') = s.digest)
  ORDER BY s.rowid`;
function cleanupRows(client: Pick<Client, 'execute'>, table: string, runId: string) {
  return client.execute(
    table === 'vrq_sources'
      ? { sql: cleanableSources, args: [runId, runId, runId, runId] }
      : { sql: `SELECT * FROM ${table} WHERE run_id = ? ORDER BY rowid`, args: [partition(table, runId)] },
  );
}
export interface CleanupOptions {
  databaseUrl: string;
  runtimeRoot: string;
  workflow: ReturnType<typeof createQuestionnaireWorkflow>;
  storage: MastraStorage;
}
async function tree(root: string, path: string): Promise<Array<{ path: string; digest: string }>> {
  const stat = await lstat(path);
  if (stat.isSymbolicLink()) throw new Error('UNSAFE_CLEANUP_PATH');
  if (stat.isFile()) return [{ path: relative(root, path), digest: sha256(await readFile(path)) }];
  if (!stat.isDirectory()) throw new Error('UNSAFE_CLEANUP_PATH');
  const files = (await readdir(path)).sort(),
    result = [{ path: relative(root, path) + '/', digest: sha256(canonicalJson(files)) }];
  for (const f of files) result.push(...(await tree(root, resolve(path, f))));
  return result;
}
export async function previewCleanup(runId: string, options: CleanupOptions) {
  scopedRunId.parse(runId);
  const review = await openReviewStore(options.databaseUrl),
    client = await openDatabase(options.databaseUrl);
  try {
    const state = await review.read(runId);
    if (!state || state.claimToken) throw new Error('NO_CLEANABLE_RUN');
    await containedDirectory(options.runtimeRoot, options.runtimeRoot);
    const roots: string[] = [];
    const exports = resolve(options.runtimeRoot, 'exports', runId);
    try {
      await lstat(exports);
      roots.push(exports);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
    }
    const snapshots = resolve(options.runtimeRoot, 'snapshots');
    try {
      await containedDirectory(options.runtimeRoot, snapshots);
      const exact = resolve(snapshots, `${runId}-${state.evidenceDigest}`);
      try {
        await lstat(exact);
        roots.push(exact);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
    }
    const files = [];
    for (const p of roots) files.push(...(await tree(options.runtimeRoot, p)));
    const records = [];
    for (const table of [...tables, 'vrq_sources']) {
      const rows = await cleanupRows(client, table, runId);
      records.push({ table, count: rows.rows.length, digest: sha256(canonicalJson(rows.rows)) });
    }
    const snapshot = await options.workflow.getWorkflowRunById(state.workflowRunId);
    const workflowStore = await options.storage.getStore('workflows');
    if (!workflowStore) throw new Error('WORKFLOW_STORAGE_REQUIRED');
    const all = (await workflowStore.listWorkflowRuns({ perPage: false })).runs;
    const selected: Array<{ workflowName: string; runId: string }> = [
      { workflowName: options.workflow.id, runId: state.workflowRunId },
    ];
    const key = (v: { workflowName: string; runId: string }) => `${v.workflowName}:${v.runId}`;
    for (let i = 0; i < selected.length; i++) {
      const parent = selected[i]!;
      for (const child of all) {
        const record = typeof child.snapshot === 'string' ? JSON.parse(child.snapshot) : child.snapshot;
        if (
          record.parentWorkflow?.workflowId === parent.workflowName &&
          record.parentWorkflow.runId === parent.runId &&
          !selected.some(s => key(s) === key(child))
        )
          selected.push({ workflowName: child.workflowName, runId: child.runId });
      }
    }
    const workflowRuns = selected.map(s => ({
      ...s,
      digest: sha256(canonicalJson(all.find(r => key(r) === key(s))?.snapshot ?? null)),
    }));
    const preview = {
      runId,
      revision: state.revision,
      workflowRunId: state.workflowRunId,
      workflowRuns,
      workflowDigest: sha256(canonicalJson(snapshot)),
      roots: roots.map(p => relative(options.runtimeRoot, p)),
      files,
      records,
    };
    return { ...preview, previewDigest: sha256(canonicalJson(preview)) };
  } finally {
    review.close();
    client.close();
  }
}
export async function confirmCleanup(raw: unknown, options: CleanupOptions) {
  const c = cleanupConfirmationSchema.parse(raw),
    preview = await previewCleanup(c.runId, options);
  if (preview.revision !== c.revision || preview.previewDigest !== c.previewDigest)
    throw new Error('STALE_CLEANUP_PREVIEW');
  const client = await openDatabase(options.databaseUrl);
  try {
    // Serialize approval/revision ownership before destructive work; no transaction spans filesystem operations.
    await writeTransaction(client, async tx => {
      const rows = await tx.execute({
        sql: 'SELECT state_json,claim_token FROM vrq_review WHERE run_id = ?',
        args: [c.runId],
      });
      const state = reviewStateSchema.parse(JSON.parse(String(rows.rows[0]?.state_json)));
      if (state.claimToken || rows.rows[0]?.claim_token || state.revision !== preview.revision)
        throw new Error('STALE_CLEANUP_PREVIEW');
      for (const record of preview.records) {
        const current = await cleanupRows(tx, record.table, c.runId);
        if (sha256(canonicalJson(current.rows)) !== record.digest) throw new Error('STALE_CLEANUP_PREVIEW');
      }
      const token = `cleanup-${c.previewDigest}`;
      const changed = await tx.execute({
        sql: 'UPDATE vrq_review SET state_json = ?,claim_token = ? WHERE run_id = ? AND claim_token IS NULL',
        args: [canonicalJson({ ...state, claimToken: token, claimAt: new Date().toISOString() }), token, c.runId],
      });
      if (changed.rowsAffected !== 1) throw new Error('CLEANUP_BUSY');
    });
    for (const path of preview.roots) {
      const absolute = resolve(options.runtimeRoot, path);
      await containedDirectory(options.runtimeRoot, absolute);
      await tree(options.runtimeRoot, absolute);
      await chmod(absolute, 0o700);
      await rm(absolute, { recursive: true });
    }
    const workflowStore = await options.storage.getStore('workflows');
    if (!workflowStore) throw new Error('WORKFLOW_STORAGE_REQUIRED');
    for (const run of [...preview.workflowRuns].reverse()) {
      if (run.workflowName === options.workflow.id && run.runId === preview.workflowRunId)
        await options.workflow.deleteWorkflowRunById(run.runId);
      else await workflowStore.deleteWorkflowRunById({ workflowName: run.workflowName, runId: run.runId });
    }
    const deletedRecords = await writeTransaction(client, async tx => {
      // Recheck shared references inside the final write transaction before removing
      // either the source bytes or this run's references to them.
      const sources = await cleanupRows(tx, 'vrq_sources', c.runId);
      let count = 0;
      for (const source of sources.rows)
        count += (await tx.execute({ sql: 'DELETE FROM vrq_sources WHERE digest = ?', args: [source.digest!] }))
          .rowsAffected;
      for (const table of tables)
        count += (await tx.execute({ sql: `DELETE FROM ${table} WHERE run_id = ?`, args: [partition(table, c.runId)] }))
          .rowsAffected;
      return count;
    });
    return {
      runId: c.runId,
      deletedRecords,
      deletedFiles: preview.files.length,
    };
  } finally {
    client.close();
  }
}
