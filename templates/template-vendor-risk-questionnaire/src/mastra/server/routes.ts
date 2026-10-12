import { registerApiRoute } from '@mastra/core/server';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import { defaultLimits } from '../contracts/limits.ts';
import { scopedRunId, reviewDecisionSchema } from '../contracts/review.ts';
import { sha256 } from '../intake/source.ts';
import { databaseUrl, runtimeRoot, openDatabase } from '../persistence/database.ts';
import { openRespondStore } from '../persistence/respond.ts';
import { openReviewStore } from '../persistence/review.ts';
import { openProcessingStore } from '../persistence/processing.ts';
import { openIntakeStore } from '../persistence/store.ts';
import { loadEvidenceProfile } from '../runtime/profile.ts';
import { prepareResponse } from '../runtime/respond.ts';
import { submitReview } from '../review/service.ts';
import { publishExport } from '../exports/publication.ts';
import { readDomainMetrics } from '../observability/metrics.ts';
import { recoverQuestionnaire, vendorRiskQuestionnaire } from '../workflows/vendor-risk-questionnaire.ts';

const active = new Set<string>();
const prompts = new Map<string, { id: string; text: string; context: string; resolve: (answer: string) => void }>();
const uploadSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(255)
    .regex(/^[^/\\\u0000-\u001f]+\.(xlsx|docx)$/i),
  size: z.number().int().positive().max(defaultLimits.maxBytes),
});
const answerSchema = z.object({ id: z.uuid(), answer: z.string().max(4000) }).strict();
const safeError = (e: unknown) =>
  e instanceof Error && /^[A-Z][A-Z0-9_]{0,79}$/.test(e.message)
    ? e.message
    : e instanceof z.ZodError
      ? 'INVALID_INPUT'
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
async function background(runId: string, work: () => Promise<unknown>) {
  if (active.has(runId)) throw new Error('RUN_BUSY');
  active.add(runId);
  try {
    await setError(runId, null);
  } catch (error) {
    active.delete(runId);
    throw error;
  }
  void work()
    .catch(error => setError(runId, safeError(error)))
    .catch(() => {})
    .finally(() => {
      active.delete(runId);
      prompts.delete(runId);
    });
}
async function prepare(runId: string) {
  const profile = await loadEvidenceProfile(runtimeRoot);
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
      ask: text => new Promise<string>(resolve => prompts.set(runId, { id: randomUUID(), text, context, resolve })),
    },
  });
}
async function options() {
  const profile = await loadEvidenceProfile(runtimeRoot);
  return { databaseUrl, runtimeRoot, evidenceRoot: profile.evidenceRoot, manifestPath: profile.manifestPath };
}
async function reviewFor(runId: string) {
  const store = await openReviewStore(databaseUrl);
  try {
    return await store.read(runId);
  } finally {
    store.close();
  }
}
async function finish(runId: string) {
  const state = await reviewFor(runId);
  if (!state?.projection || !['approved', 'exporting'].includes(state.state)) throw new Error('APPROVAL_REQUIRED');
  const { run } = await recoverQuestionnaire(vendorRiskQuestionnaire, state.workflowRunId);
  const result = await run.resume({
    step: 'review-answer-set',
    resumeData: {
      approvalId: state.projection.approvalId,
      revision: state.revision,
      digest: state.digest,
    },
  });
  if (result.status !== 'success') throw new Error('PUBLICATION_INCOMPLETE');
}
async function list() {
  const processing = await openProcessingStore(databaseUrl),
    review = await openReviewStore(databaseUrl),
    db = await openDatabase(databaseUrl);
  try {
    const rows =
      await db.execute(`SELECT ids.run_id, s.original_name, c.checkpoint_json, i.created_at, p.run_json, r.state_json, j.run_id AS http_run, j.error
      FROM (SELECT run_id FROM vrq_intakes UNION SELECT run_id FROM vrq_respond) ids
      LEFT JOIN vrq_intakes i ON i.run_id=ids.run_id LEFT JOIN vrq_sources s ON s.digest=i.source_digest
      LEFT JOIN vrq_respond c ON c.run_id=ids.run_id LEFT JOIN vrq_processing p ON p.run_id=ids.run_id
      LEFT JOIN vrq_review r ON r.run_id=ids.run_id LEFT JOIN vrq_http_jobs j ON j.run_id=ids.run_id
      ORDER BY i.created_at DESC, ids.run_id`);
    return rows.rows.map(row => {
      const runId = String(row.run_id),
        state = row.state_json ? JSON.parse(String(row.state_json)) : null;
      const native = row.run_json ? JSON.parse(String(row.run_json)) : null;
      return {
        runId,
        name: row.original_name ?? JSON.parse(String(row.checkpoint_json)).originalName,
        state: prompts.has(runId)
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
        error: row.error ?? native?.stopReason ?? null,
        metrics: !!native,
        download: state?.state === 'exported' ? `/vrq/questionnaires/${runId}/download` : null,
      };
    });
  } finally {
    db.close();
    processing.close();
    review.close();
  }
}
async function guarded(work: () => Promise<Response>) {
  try {
    const response = await work();
    response.headers.set('Cache-Control', 'no-store');
    return response;
  } catch (error) {
    const code = safeError(error);
    return Response.json(
      { error: code },
      { status: code === 'RUN_NOT_FOUND' ? 404 : code === 'INVALID_INPUT' ? 400 : 409 },
    );
  }
}
// Stream-limit before parsing multipart data; Content-Length alone is not a trusted bound.
async function upload(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error('FILE_REQUIRED');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > defaultLimits.maxBytes + 65536) {
        await reader.cancel();
        throw new Error('FILE_SIZE_LIMIT');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const form = await new Response(Buffer.concat(chunks), {
    headers: { 'Content-Type': request.headers.get('Content-Type') ?? '' },
  }).formData();
  const file = form.get('file');
  if (!(file instanceof File) || form.getAll('file').length !== 1) throw new Error('FILE_REQUIRED');
  uploadSchema.parse({ name: file.name, size: file.size });
  await loadEvidenceProfile(runtimeRoot);
  const runId = randomUUID().replace(/[0-9]/g, digit => String.fromCharCode(103 + Number(digit)));
  const bytes = new Uint8Array(await file.arrayBuffer()),
    checkpoints = await openRespondStore(databaseUrl);
  try {
    await checkpoints.initialize(runId, {
      sourceId: `input-${runId}`,
      originalName: file.name,
      bytes,
      sizeBytes: bytes.length,
      sha256: sha256(bytes),
    });
  } finally {
    checkpoints.close();
  }
  await background(runId, () => prepare(runId));
  return Response.json({ runId }, { status: 202 });
}
export const questionnaireRoutes = [
  registerApiRoute('/vrq/questionnaires', {
    method: 'GET',
    handler: () => guarded(async () => Response.json(await list())),
  }),
  registerApiRoute('/vrq/questionnaires', { method: 'POST', handler: c => guarded(() => upload(c.req.raw)) }),
  registerApiRoute('/vrq/questionnaires/:runId', {
    method: 'GET',
    handler: c =>
      guarded(async () => {
        const runId = scopedRunId.parse(c.req.param('runId'));
        const item = (await list()).find(row => row.runId === runId);
        if (!item) throw new Error('RUN_NOT_FOUND');
        const intake = await openIntakeStore(databaseUrl),
          db = await openDatabase(databaseUrl);
        try {
          const evidence = await intake.readEvidence(runId),
            prompt = prompts.get(runId);
          const payload = await db.execute({
            sql: 'SELECT dispositions_json FROM vrq_review_payloads WHERE run_id=?',
            args: [runId],
          });
          return Response.json({
            ...item,
            review: await reviewFor(runId),
            dispositions: payload.rows[0] ? JSON.parse(String(payload.rows[0].dispositions_json)) : [],
            documents:
              evidence?.documents.map(d => ({ id: d.id, label: d.citationLabel, disclosure: d.disclosure })) ?? [],
            prompt: prompt ? { id: prompt.id, text: prompt.text, context: prompt.context } : null,
          });
        } finally {
          intake.close();
          db.close();
        }
      }),
  }),
  registerApiRoute('/vrq/questionnaires/:runId/input', {
    method: 'POST',
    handler: c =>
      guarded(async () => {
        const runId = scopedRunId.parse(c.req.param('runId')),
          input = answerSchema.parse(await c.req.json()),
          prompt = prompts.get(runId);
        if (!prompt || prompt.id !== input.id) throw new Error('STALE_INPUT');
        prompts.delete(runId);
        prompt.resolve(input.answer);
        return Response.json({ runId }, { status: 202 });
      }),
  }),
  registerApiRoute('/vrq/questionnaires/:runId/review', {
    method: 'POST',
    handler: c =>
      guarded(async () => {
        const runId = scopedRunId.parse(c.req.param('runId')),
          decision = reviewDecisionSchema.parse(await c.req.json());
        if (decision.runId !== runId) throw new Error('RUN_MISMATCH');
        const state = await reviewFor(runId);
        if (!state) throw new Error('RUN_NOT_FOUND');
        if (state.revision !== decision.expectedRevision || state.digest !== decision.expectedDigest)
          throw new Error('STALE_REVIEW');
        await background(runId, async () => {
          await submitReview(decision, await options());
          if (decision.finalApproval) await finish(runId);
        });
        return Response.json({ runId }, { status: 202 });
      }),
  }),
  registerApiRoute('/vrq/questionnaires/:runId/resume', {
    method: 'POST',
    handler: c =>
      guarded(async () => {
        const runId = scopedRunId.parse(c.req.param('runId')),
          item = (await list()).find(row => row.runId === runId);
        if (!item) throw new Error('RUN_NOT_FOUND');
        const state = await reviewFor(runId);
        // Never restart interrupted model work or replenish a saved budget from the browser.
        if (!state && item.metrics) throw new Error('WORKFLOW_RECOVERY_REQUIRED');
        await background(runId, () => (state ? finish(runId) : prepare(runId)));
        return Response.json({ runId }, { status: 202 });
      }),
  }),
  registerApiRoute('/vrq/questionnaires/:runId/metrics', {
    method: 'GET',
    handler: c =>
      guarded(async () => Response.json(await readDomainMetrics(databaseUrl, scopedRunId.parse(c.req.param('runId'))))),
  }),
  registerApiRoute('/vrq/questionnaires/:runId/download', {
    method: 'GET',
    handler: c =>
      guarded(async () => {
        const runId = scopedRunId.parse(c.req.param('runId'));
        if ((await reviewFor(runId))?.state !== 'exported') throw new Error('PUBLICATION_INCOMPLETE');
        const result = await publishExport(runId, await options());
        const bytes = await readFile(result.path),
          file = result.manifest.files[0]!;
        if (sha256(bytes) !== file.sha256) throw new Error('ARTIFACT_HASH_MISMATCH');
        return new Response(bytes, {
          headers: {
            'Content-Type':
              result.manifest.format === 'xlsx'
                ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'Content-Disposition': `attachment; filename="${file.name}"`,
            'Cache-Control': 'no-store',
            'X-Content-Type-Options': 'nosniff',
          },
        });
      }),
  }),
];
