import { readDomainMetrics } from '../src/mastra/observability/metrics.ts';
import { createLocalObservability, SafeLogger } from '../src/mastra/observability/privacy.ts';
import { parseArgs } from 'node:util';
import { readFile } from 'node:fs/promises';
import { Mastra } from '@mastra/core';
import {
  databaseUrl,
  runtimeRoot,
  storage,
  nativeStorage,
  configureReadOnlyAccess,
  telemetryHealth,
} from '../src/mastra/persistence/database.ts';
import { vendorRiskQuestionnaire, recoverQuestionnaire } from '../src/mastra/workflows/vendor-risk-questionnaire.ts';
import { openReviewStore } from '../src/mastra/persistence/review.ts';
import { reviewDecisionSchema, scopedRunId } from '../src/mastra/contracts/review.ts';
import { submitReview } from '../src/mastra/review/service.ts';
import { publishExport } from '../src/mastra/exports/publication.ts';
import { previewCleanup, confirmCleanup, cleanupConfirmationSchema } from '../src/mastra/runtime/maintenance.ts';
import { loadEvidenceProfile } from '../src/mastra/runtime/profile.ts';

const observability = createLocalObservability();

try {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: Object.fromEntries(
      ['run-id', 'root', 'manifest', 'decision', 'confirmation', 'claim-token'].map(k => [
        k,
        { type: 'string' as const },
      ]),
    ),
  });
  if (
    !['metrics', 'status', 'submit', 'resume', 'export', 'recover-claim', 'cleanup-preview', 'cleanup'].includes(
      positionals[0]!,
    )
  )
    throw new Error('UNKNOWN_REVIEW_COMMAND');
  const runId = scopedRunId.parse(values['run-id']),
    options = { databaseUrl, runtimeRoot };
  if (['status', 'metrics'].includes(positionals[0]!)) configureReadOnlyAccess();
  else {
    const tracing = !['cleanup-preview', 'cleanup', 'recover-claim'].includes(positionals[0]!);
    if (!tracing) nativeStorage.deferTelemetry();
    await storage.init();
    new Mastra({
      logger: new SafeLogger(),
      ...(tracing ? { observability } : {}),
      storage,
      workflows: { vendorRiskQuestionnaire },
    });
  }
  async function evidenceOptions() {
    if ((values.root === undefined) !== (values.manifest === undefined))
      throw new Error('COMPLETE_EVIDENCE_OVERRIDE_REQUIRED');
    if (values.root !== undefined && (!values.root || !values.manifest))
      throw new Error('COMPLETE_EVIDENCE_OVERRIDE_REQUIRED');
    const paths =
      values.root && values.manifest
        ? { evidenceRoot: values.root, manifestPath: values.manifest }
        : await loadEvidenceProfile(runtimeRoot);
    return { ...options, evidenceRoot: paths.evidenceRoot, manifestPath: paths.manifestPath };
  }
  const review = await openReviewStore();
  try {
    if (positionals[0] === 'metrics') console.log(JSON.stringify(await readDomainMetrics(databaseUrl, runId), null, 2));
    else if (positionals[0] === 'status') console.log(JSON.stringify(await review.read(runId), null, 2));
    else if (positionals[0] === 'recover-claim') {
      await review.recoverClaim(runId, values['claim-token']!);
      console.log(JSON.stringify({ runId, state: 'claim-recovered' }));
    } else if (positionals[0] === 'submit') {
      const decision = reviewDecisionSchema.parse(JSON.parse(await readFile(values.decision!, 'utf8')));
      if (decision.runId !== runId) throw new Error('FOREIGN_REVIEW');
      const state = await submitReview(decision, await evidenceOptions());
      console.log(JSON.stringify({ runId, revision: state?.revision, state: state?.state, digest: state?.digest }));
    } else if (positionals[0] === 'resume') {
      const state = await review.read(runId);
      if (!state?.projection || state.state !== 'approved') throw new Error('FINAL_APPROVAL_REQUIRED');
      const recovered = await recoverQuestionnaire(vendorRiskQuestionnaire, state.workflowRunId);
      const result = await recovered.run.resume({
        step: 'review-answer-set',
        resumeData: { approvalId: state.projection.approvalId, revision: state.revision, digest: state.digest },
      });
      console.log(JSON.stringify({ runId, workflowStatus: result.status }));
      if (result.status !== 'success') process.exitCode = 1;
    } else if (positionals[0] === 'export')
      console.log(JSON.stringify((await publishExport(runId, await evidenceOptions())).manifest));
    else if (positionals[0] === 'cleanup-preview')
      console.log(
        JSON.stringify(
          await previewCleanup(runId, { ...options, workflow: vendorRiskQuestionnaire, storage }),
          null,
          2,
        ),
      );
    else if (positionals[0] === 'cleanup') {
      const confirmation = cleanupConfirmationSchema.parse(JSON.parse(await readFile(values.confirmation!, 'utf8')));
      if (confirmation.runId !== runId) throw new Error('FOREIGN_CLEANUP');
      console.log(
        JSON.stringify(
          await confirmCleanup(confirmation, {
            ...options,
            workflow: vendorRiskQuestionnaire,
            storage,
          }),
        ),
      );
    }
  } finally {
    review.close();
  }
} catch (error) {
  const safeCodes = new Set([
    'UNKNOWN_REVIEW_COMMAND',
    'FOREIGN_REVIEW',
    'FOREIGN_CLEANUP',
    'FINAL_APPROVAL_REQUIRED',
    'COMPLETE_EVIDENCE_OVERRIDE_REQUIRED',
  ]);
  const code = error instanceof Error && safeCodes.has(error.message) ? error.message : 'REVIEW_OPERATION_FAILED';
  console.error(JSON.stringify({ code }));
  if (code === 'UNKNOWN_REVIEW_COMMAND')
    console.error('Use metrics, status, submit, resume, export, recover-claim, cleanup-preview or cleanup.');
  process.exitCode = 1;
} finally {
  let cleanupFailed = false;
  try {
    await observability.shutdown();
  } catch {
    cleanupFailed = true;
  }
  try {
    await nativeStorage.close();
  } catch {
    cleanupFailed = true;
  }
  if (cleanupFailed) {
    console.error(JSON.stringify({ code: 'STORAGE_FAILURE' }));
    process.exitCode = 1;
  }
  if (telemetryHealth.status === 'degraded_incomplete')
    console.error(JSON.stringify({ telemetry: telemetryHealth.status }));
}
