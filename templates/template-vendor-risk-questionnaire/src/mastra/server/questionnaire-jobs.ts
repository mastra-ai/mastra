import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { serviceLimits } from '../contracts/service-limits.ts';
import { databaseUrl, openDatabase, runtimeRoot } from '../persistence/database.ts';
import { openProcessingStore } from '../persistence/processing.ts';
import { openReviewStore } from '../persistence/review.ts';
import { loadEvidenceProfile } from '../runtime/profile.ts';
import { prepareResponse } from '../runtime/respond.ts';
import { recoverQuestionnaire, vendorRiskQuestionnaire } from '../workflows/vendor-risk-questionnaire.ts';

import {
  beginExecution,
  endExecution,
  runCancellable,
  checkCancellation,
  executionSignal,
} from '../runtime/cancellation.ts';

const active = new Map<string, AbortController>();
const mutations = new Set<string>();
const prompts = new Map<string, { id: string; text: string; context: string; resolve: (answer: string) => void }>();
export const safeError = (e: unknown) =>
  e instanceof Error && /^[A-Z][A-Z0-9_]{0,79}$/.test(e.message)
    ? e.message
    : e instanceof z.ZodError
      ? e.issues.some(issue => issue.code === 'custom' && issue.params?.code === 'EXPLANATION_FIELD_REQUIRED')
        ? 'EXPLANATION_FIELD_REQUIRED'
        : 'INVALID_INPUT'
      : 'REQUEST_FAILED';
async function setError(runId: string, error: string | null) {
  const db = await openDatabase(databaseUrl);
  try {
    await db.execute({
      sql: 'INSERT INTO vrq_http_jobs VALUES (?,?) ON CONFLICT(run_id) DO UPDATE SET error=excluded.error',
      args: [runId, error],
    });
  } finally {
    db.close();
  }
}
export async function requireQuestionnaire(runId: string, writable = false) {
  const item = (await listQuestionnaires()).find(row => row.runId === runId);
  if (!item) throw new Error('RUN_NOT_FOUND');
  if (writable && ['cancelled', 'cancelling'].includes(item.state)) throw new Error('RUN_CANCELLED');
  return item;
}
async function setLifecycle(runId: string, state: 'cancelled' | 'removed') {
  const db = await openDatabase(databaseUrl);
  try {
    await db.execute({
      sql: 'INSERT INTO vrq_questionnaire_lifecycle VALUES (?,?) ON CONFLICT(run_id) DO UPDATE SET state=excluded.state',
      args: [runId, state],
    });
  } finally {
    db.close();
  }
}
export async function cancelQuestionnaire(runId: string) {
  if (mutations.has(runId)) throw new Error('RUN_BUSY');
  mutations.add(runId);
  try {
    const item = await requireQuestionnaire(runId);
    if (item.state === 'cancelled' || item.state === 'cancelling') return;
    const controller = active.get(runId);
    if (!controller) throw new Error('RUN_NOT_ACTIVE');
    await setLifecycle(runId, 'cancelled');
    controller.abort(new Error('OPERATOR_CANCELLED'));
  } finally {
    mutations.delete(runId);
  }
}
export async function removeQuestionnaire(runId: string) {
  if (active.has(runId) || mutations.has(runId)) throw new Error('RUN_BUSY');
  mutations.add(runId);
  try {
    await requireQuestionnaire(runId);
    await setLifecycle(runId, 'removed');
  } finally {
    mutations.delete(runId);
  }
}
export async function startJob(runId: string, work: () => Promise<unknown>) {
  if (active.has(runId) || mutations.has(runId)) throw new Error('RUN_BUSY');
  if (active.size >= serviceLimits.maxActiveJobs) throw new Error('ACTIVE_RUN_LIMIT');
  const controller = beginExecution(runId);
  active.set(runId, controller);
  try {
    await requireQuestionnaire(runId, true);
    await setError(runId, null);
  } catch (error) {
    active.delete(runId);
    endExecution(runId);
    throw error;
  }
  void Promise.resolve()
    .then(() => {
      controller.signal.throwIfAborted();
      return work();
    })
    .catch(error => (controller.signal.aborted ? undefined : setError(runId, safeError(error))))
    .catch(() => {})
    .finally(() => {
      active.delete(runId);
      endExecution(runId);
      prompts.delete(runId);
    });
}
export async function prepareQuestionnaire(runId: string) {
  const profile = await loadEvidenceProfile(runtimeRoot);
  checkCancellation(runId);
  const signal = executionSignal(runId);
  let context = '';
  return prepareResponse({
    databaseUrl,
    runtimeRoot,
    profile,
    workflow: vendorRiskQuestionnaire,
    resume: runId,
    io: {
      show: text => {
        context = text;
      },
      ask: text =>
        new Promise<string>((resolve, reject) => {
          signal?.throwIfAborted();
          const abort = () => {
            prompts.delete(runId);
            reject(signal?.reason);
          };
          signal?.addEventListener('abort', abort, { once: true });
          prompts.set(runId, {
            id: randomUUID(),
            text,
            context,
            resolve: value => {
              signal?.removeEventListener('abort', abort);
              resolve(value);
            },
          });
        }),
    },
  });
}
export async function reviewOptions() {
  const profile = await loadEvidenceProfile(runtimeRoot);
  return { databaseUrl, runtimeRoot, evidenceRoot: profile.evidenceRoot, manifestPath: profile.manifestPath };
}
export async function readReview(runId: string) {
  const store = await openReviewStore(databaseUrl);
  try {
    return await store.read(runId);
  } finally {
    store.close();
  }
}
export async function publishQuestionnaire(runId: string) {
  const state = await readReview(runId);
  if (!state?.projection || !['approved', 'exporting'].includes(state.state)) throw new Error('APPROVAL_REQUIRED');
  const projection = state.projection;
  const { run } = await recoverQuestionnaire(vendorRiskQuestionnaire, state.workflowRunId);
  const result = await runCancellable(runId, run, () =>
    run.resume({
      step: 'review-answer-set',
      resumeData: {
        approvalId: projection.approvalId,
        revision: state.revision,
        digest: state.digest,
      },
    }),
  );
  if (result.status !== 'success') throw new Error('PUBLICATION_INCOMPLETE');
}
export async function listQuestionnaires() {
  const processing = await openProcessingStore(databaseUrl),
    review = await openReviewStore(databaseUrl),
    db = await openDatabase(databaseUrl);
  try {
    const rows =
      await db.execute(`SELECT ids.run_id, s.original_name, c.checkpoint_json, i.created_at, p.run_json, r.state_json, j.run_id AS http_run, j.error, l.state AS lifecycle
      FROM (SELECT run_id FROM vrq_intakes UNION SELECT run_id FROM vrq_respond) ids
      LEFT JOIN vrq_intakes i ON i.run_id=ids.run_id LEFT JOIN vrq_sources s ON s.digest=i.source_digest
      LEFT JOIN vrq_respond c ON c.run_id=ids.run_id LEFT JOIN vrq_processing p ON p.run_id=ids.run_id
      LEFT JOIN vrq_review r ON r.run_id=ids.run_id LEFT JOIN vrq_http_jobs j ON j.run_id=ids.run_id
      LEFT JOIN vrq_questionnaire_lifecycle l ON l.run_id=ids.run_id
      WHERE l.state IS NULL OR l.state != 'removed'
      ORDER BY i.created_at DESC, ids.run_id`);
    return rows.rows.map(row => {
      const runId = String(row.run_id),
        state = row.state_json ? JSON.parse(String(row.state_json)) : null;
      const native = row.run_json ? JSON.parse(String(row.run_json)) : null;
      return {
        runId,
        name: row.original_name ?? JSON.parse(String(row.checkpoint_json)).originalName,
        state:
          row.lifecycle === 'cancelled'
            ? active.has(runId)
              ? 'cancelling'
              : 'cancelled'
            : prompts.has(runId)
              ? 'awaiting_input'
              : active.has(runId)
                ? 'processing'
                : (state?.state ??
                  (row.error
                    ? 'failed'
                    : native?.state === 'failed'
                      ? 'failed'
                      : !row.http_run && native
                        ? native.state
                        : 'interrupted')),
        error: row.lifecycle === 'cancelled' ? null : (row.error ?? native?.stopReason ?? null),
        metrics: !!native,
        download: !row.lifecycle && state?.state === 'exported' ? `/vrq/questionnaires/${runId}/download` : null,
      };
    });
  } finally {
    db.close();
    processing.close();
    review.close();
  }
}
export function pendingPrompt(runId: string) {
  const prompt = prompts.get(runId);
  return prompt ? { id: prompt.id, text: prompt.text, context: prompt.context } : null;
}
export function answerPrompt(runId: string, input: { id: string; answer: string }) {
  const prompt = prompts.get(runId);
  if (!prompt || prompt.id !== input.id) throw new Error('STALE_INPUT');
  prompts.delete(runId);
  prompt.resolve(input.answer);
}
