import { operation } from '../runtime/operations.js';
import { hashBytes, outputArtifactSchema, type OperationContext, type OutputProvider } from '../domain/contracts.js';
import { reportOutputRequestSchema, correctionOutputRequestSchema } from '../domain/output-contracts.js';
import { IntakeError, safeFailure } from '../domain/errors.js';
import type { ReviewRepository } from '../storage/reviews.js';
import type { FinalizationRepository } from '../storage/finalizations.js';
import { artifactBytes } from '../storage/artifact-files.js';

export function createReviewService(
  repository: ReviewRepository,
  finalizations: FinalizationRepository,
  reportProvider: OutputProvider<'reportOutput'>,
  correctionProvider: OutputProvider<'correctionOutput'>,
) {
  const providers = { reportOutput: reportProvider.id, correctionOutput: correctionProvider.id };
  async function finalize(context: OperationContext, reportId: string) {
    const started = Date.now();
    const { publication, approval } = await finalizations.authority(context, reportId);
    const finalization = await finalizations.prepare(context, reportId);
    try {
      for (const artifact of finalization.artifacts) {
        if (artifact.descriptor) {
          finalizations.binding(artifact, artifact.descriptor, approval);
          await artifactBytes(repository.reports.root, artifact.id, artifact.descriptor.hash);
          continue;
        }
        const provider = artifact.stage === 'reportOutput' ? reportProvider : correctionProvider;
        if (provider.id !== artifact.providerId)
          throw new IntakeError(
            'PROVIDER_CONFIGURATION',
            'The output provider frozen with this approval is unavailable.',
            'Restore that provider registration before retrying. The approved publication will not be redirected.',
            409,
          );
        const common = {
          operationId: artifact.operationId,
          snapshotId: publication.snapshot.id,
          snapshotHash: publication.hash,
          snapshot: publication.snapshot,
          approval,
        };
        const outputContext = { ...context, outputDirectory: repository.reports.root };
        // Each provider sees its stage-specific validated approved contract.
        const descriptor = outputArtifactSchema.parse(
          artifact.stage === 'reportOutput'
            ? await reportProvider.materialize(
                reportOutputRequestSchema.parse({ ...common, stage: 'reportOutput' }),
                outputContext,
              )
            : await correctionProvider.materialize(
                correctionOutputRequestSchema.parse({ ...common, stage: 'correctionOutput' }),
                outputContext,
              ),
        );
        finalizations.binding(artifact, descriptor, approval);
        const bytes = await provider.retrieve(descriptor, outputContext);
        if (!bytes.length || hashBytes(bytes) !== descriptor.hash)
          throw new IntakeError(
            'ARTIFACT_INTEGRITY',
            'The approved output bytes do not match their checksum.',
            'Correct the selected provider and retry the same saved approval.',
            409,
          );
        await finalizations.save(context, reportId, artifact.id, descriptor, bytes);
      }
      const saved = await finalizations.finish(context, reportId);
      operation({
        stage: 'finalization',
        outcome: 'completed',
        caseId: publication.snapshot.caseId,
        runId: publication.snapshot.workflowRunId,
        reportId,
        version: publication.snapshot.version,
        durationMs: Date.now() - started,
        costMicros: null,
      });
      return saved;
    } catch (error) {
      const failure =
        error instanceof IntakeError
          ? error
          : new IntakeError(
              'FINALIZATION_FAILED',
              'Approval is saved, but final publication could not be completed.',
              'Check private storage and the selected providers, then retry /report with retryPublication true. No new approval is needed.',
              503,
            );
      await finalizations.fail(context, reportId, failure);
      operation({
        stage: 'finalization',
        outcome: 'failed',
        caseId: publication.snapshot.caseId,
        reportId,
        costMicros: null,
      });
      throw failure;
    }
  }
  return {
    repository,
    finalizations,
    finalize,
    async record(context: OperationContext, input: unknown, origin: { messageId: string; text: string }) {
      const started = Date.now();
      const receipt = await repository.record(context, input, origin, providers);
      const publication = await repository.reports.get(context, receipt.reportId);
      operation({
        stage: 'review',
        outcome:
          receipt.state === 'REVISION_REQUESTED'
            ? 'revised'
            : receipt.approvalId
              ? 'approved'
              : receipt.state === 'REJECTED'
                ? 'rejected'
                : 'recorded',
        caseId: receipt.caseId,
        reportId: receipt.reportId,
        version: publication!.snapshot.version,
        turnaroundMs: Math.max(0, Date.now() - Date.parse(publication!.snapshot.createdAt)),
        overrides: (await repository.events(context)).filter(
          e => e.reportId === receipt.reportId && e.disposition?.severityOverride,
        ).length,
        revision: (await repository.reports.reconciliation.cases.requireCase(context)).revision,
        durationMs: Date.now() - started,
        costMicros: null,
      });
      return receipt;
    },
    async status(context: OperationContext, reportId: string) {
      const approval = await repository.approval(context, reportId);
      const events = (await repository.events(context)).filter(e => e.reportId === reportId);
      const finalization = await finalizations.get(context, reportId);
      let failure = finalization?.failure ?? null;
      if (finalization?.state === 'PUBLISHED') {
        try {
          for (const artifact of finalization.artifacts)
            await finalizations.download(context, finalization.caseId, artifact.id);
        } catch (error) {
          failure = safeFailure(error);
        }
      }
      const available = finalization?.state === 'PUBLISHED' && !failure;
      return {
        approval,
        events,
        finalization: finalization
          ? {
              ...finalization,
              available,
              artifacts: available
                ? finalization.artifacts.map(a => ({
                    id: a.id,
                    ...a.descriptor!,
                    url: `/insurance/artifacts/${a.id}?caseId=${finalization.caseId}&threadId=${encodeURIComponent(context.threadId)}`,
                  }))
                : [],
              failure,
            }
          : null,
      };
    },
  };
}
export type ReviewService = ReturnType<typeof createReviewService>;
