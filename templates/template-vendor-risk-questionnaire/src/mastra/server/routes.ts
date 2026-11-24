import { registerApiRoute, type ApiRoute } from '@mastra/core/server';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import { reviewDecisionSchema, scopedRunId } from '../contracts/review.ts';
import { publishExport } from '../exports/publication.ts';
import { sha256 } from '../intake/source.ts';
import { readDomainMetrics } from '../observability/metrics.ts';
import { databaseUrl, openDatabase, runtimeRoot, telemetryHealth } from '../persistence/database.ts';
import { openRespondStore } from '../persistence/respond.ts';
import { openIntakeStore } from '../persistence/store.ts';
import {
  answerPrompt,
  cancelQuestionnaire,
  removeQuestionnaire,
  requireQuestionnaire,
  listQuestionnaires,
  pendingPrompt,
  prepareQuestionnaire,
  publishQuestionnaire,
  readReview,
  reviewOptions,
  safeError,
  startJob,
} from './questionnaire-jobs.ts';
import { readQuestionnaireUpload } from './upload.ts';
import { submitReview } from '../review/service.ts';
import { loadEvidenceProfile } from '../runtime/profile.ts';

const answerSchema = z.object({ id: z.uuid(), answer: z.string().max(4000) }).strict();
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
export const telemetryRoute = <ApiRoute>{
  path: '/vrq/telemetry-status',
  method: 'GET',
  handler: () => Response.json({ telemetry: telemetryHealth.status }),
};

export const questionnaireRoutes = [
  registerApiRoute('/vrq/questionnaires', {
    method: 'GET',
    handler: () => guarded(async () => Response.json(await listQuestionnaires())),
  }),
  registerApiRoute('/vrq/questionnaires', {
    method: 'POST',
    handler: c =>
      guarded(async () => {
        const file = await readQuestionnaireUpload(c.req.raw);
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
        await startJob(runId, () => prepareQuestionnaire(runId));
        return Response.json({ runId }, { status: 202 });
      }),
  }),
  registerApiRoute('/vrq/questionnaires/:runId', {
    method: 'GET',
    handler: c =>
      guarded(async () => {
        const runId = scopedRunId.parse(c.req.param('runId'));
        const item = await requireQuestionnaire(runId);
        const intake = await openIntakeStore(databaseUrl),
          db = await openDatabase(databaseUrl);
        try {
          const evidence = await intake.readEvidence(runId),
            prompt = pendingPrompt(runId);
          const payload = await db.execute({
            sql: 'SELECT dispositions_json FROM vrq_review_payloads WHERE run_id=?',
            args: [runId],
          });
          return Response.json({
            ...item,
            review: await readReview(runId),
            dispositions: payload.rows[0] ? JSON.parse(String(payload.rows[0].dispositions_json)) : [],
            documents:
              evidence?.documents.map(d => ({ id: d.id, label: d.citationLabel, disclosure: d.disclosure })) ?? [],
            prompt,
          });
        } finally {
          intake.close();
          db.close();
        }
      }),
  }),
  registerApiRoute('/vrq/questionnaires/:runId', {
    method: 'DELETE',
    handler: c =>
      guarded(async () => {
        await removeQuestionnaire(scopedRunId.parse(c.req.param('runId')));
        return new Response(null, { status: 204 });
      }),
  }),
  registerApiRoute('/vrq/questionnaires/:runId/cancel', {
    method: 'POST',
    handler: c =>
      guarded(async () => {
        const runId = scopedRunId.parse(c.req.param('runId'));
        await cancelQuestionnaire(runId);
        return Response.json({ runId }, { status: 202 });
      }),
  }),
  registerApiRoute('/vrq/questionnaires/:runId/input', {
    method: 'POST',
    handler: c =>
      guarded(async () => {
        const runId = scopedRunId.parse(c.req.param('runId')),
          input = answerSchema.parse(await c.req.json());
        await requireQuestionnaire(runId, true);
        answerPrompt(runId, input);
        return Response.json({ runId }, { status: 202 });
      }),
  }),
  registerApiRoute('/vrq/questionnaires/:runId/review', {
    method: 'POST',
    handler: c =>
      guarded(async () => {
        const runId = scopedRunId.parse(c.req.param('runId')),
          decision = reviewDecisionSchema.parse(await c.req.json());
        await requireQuestionnaire(runId, true);
        if (decision.runId !== runId) throw new Error('RUN_MISMATCH');
        const state = await readReview(runId);
        if (!state) throw new Error('RUN_NOT_FOUND');
        if (state.revision !== decision.expectedRevision || state.digest !== decision.expectedDigest)
          throw new Error('STALE_REVIEW');
        await startJob(runId, async () => {
          await submitReview(decision, await reviewOptions());
          if (decision.finalApproval) await publishQuestionnaire(runId);
        });
        return Response.json({ runId }, { status: 202 });
      }),
  }),
  registerApiRoute('/vrq/questionnaires/:runId/resume', {
    method: 'POST',
    handler: c =>
      guarded(async () => {
        const runId = scopedRunId.parse(c.req.param('runId')),
          item = await requireQuestionnaire(runId, true);
        const state = await readReview(runId);
        // Never restart interrupted model work or replenish a saved budget from the browser.
        if (!state && item.metrics) throw new Error('WORKFLOW_RECOVERY_REQUIRED');
        await startJob(runId, () => (state ? publishQuestionnaire(runId) : prepareQuestionnaire(runId)));
        return Response.json({ runId }, { status: 202 });
      }),
  }),
  registerApiRoute('/vrq/questionnaires/:runId/metrics', {
    method: 'GET',
    handler: c =>
      guarded(async () => {
        const runId = scopedRunId.parse(c.req.param('runId'));
        await requireQuestionnaire(runId);
        return Response.json(await readDomainMetrics(databaseUrl, runId));
      }),
  }),
  registerApiRoute('/vrq/questionnaires/:runId/download', {
    method: 'GET',
    handler: c =>
      guarded(async () => {
        const runId = scopedRunId.parse(c.req.param('runId'));
        await requireQuestionnaire(runId, true);
        if ((await readReview(runId))?.state !== 'exported') throw new Error('PUBLICATION_INCOMPLETE');
        const result = await publishExport(runId, await reviewOptions());
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
