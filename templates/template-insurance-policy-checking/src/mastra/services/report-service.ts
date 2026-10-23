import { operation } from '../runtime/operations.js';
import type { ReviewService } from './review-service.js';
import { outputArtifactSchema, hashBytes, type OperationContext, type OutputProvider } from '../domain/contracts.js';
import { draftOutputRequestSchema } from '../domain/output-contracts.js';
import { reportRequestSchema } from '../domain/reports.js';
import { IntakeError, safeFailure } from '../domain/errors.js';
import type { ReportRepository, Publication } from '../storage/reports.js';

export function createReportService(
  repository: ReportRepository,
  provider: OutputProvider<'draftOutput'>,
  review?: ReviewService,
) {
  async function publish(publication: Publication) {
    const started = Date.now();
    if (publication.state === 'PUBLISHED') {
      await repository.bytes(publication);
      return publication;
    }
    if (publication.providerId !== provider.id)
      throw new IntakeError(
        'PROVIDER_CONFIGURATION',
        'The draft provider frozen with this report is unavailable.',
        'Restore that provider registration before retrying. The report will not be redirected.',
        409,
      );
    try {
      const request = draftOutputRequestSchema.parse({
        stage: 'draftOutput',
        operationId: publication.operationId,
        snapshotId: publication.snapshot.id,
        snapshotHash: publication.hash,
        snapshot: publication.snapshot,
      });
      const artifact = outputArtifactSchema.parse(
        await provider.materialize(request, { ...publication.context, outputDirectory: repository.root }),
      );
      repository.verifyBinding(publication, artifact);
      const bytes = await provider.retrieve(artifact, { ...publication.context, outputDirectory: repository.root });
      if (hashBytes(bytes) !== artifact.hash || !bytes.length)
        throw new IntakeError(
          'ARTIFACT_INTEGRITY',
          'The output bytes do not match their declared checksum.',
          'Correct the selected provider and retry the saved report.',
          409,
        );
      await repository.stage(publication, artifact, bytes);
      await repository.bytes(publication, artifact);
      const saved = await repository.update(publication, artifact);
      operation({
        stage: 'draft',
        outcome: 'completed',
        caseId: publication.snapshot.caseId,
        runId: publication.snapshot.workflowRunId,
        reportId: publication.snapshot.id,
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
              'DRAFT_PUBLICATION_FAILED',
              'The draft could not be rendered or saved. No reviewable download was published.',
              'Check the selected provider and private storage, then retry publication of this saved report.',
              503,
            );
      await repository.update(publication, null, failure);
      operation({
        stage: 'draft',
        outcome: 'failed',
        caseId: publication.snapshot.caseId,
        reportId: publication.snapshot.id,
        version: publication.snapshot.version,
        durationMs: Date.now() - started,
        costMicros: null,
      });
      throw failure;
    }
  }
  async function current(context: OperationContext, input: unknown) {
    const request = reportRequestSchema.parse(input);
    await repository.reconciliation.cases.requireCase(context, request.caseId);
    const p = await repository.get(context, request.reportId);
    if (!p)
      throw new IntakeError(
        'REPORT_UNAVAILABLE',
        'No draft snapshot is available for this case.',
        'Complete the evidence-backed comparison before requesting a report.',
        404,
      );
    const record = await repository.reconciliation.cases.requireCase(context);
    const reviewData = review ? await review.status(context, p.snapshot.id) : undefined;
    let failure = p.failure;
    if (p.state === 'PUBLISHED')
      try {
        await repository.bytes(p);
      } catch (error) {
        failure = safeFailure(error);
      }
    const available = p.state === 'PUBLISHED' && !failure;
    return {
      report: p.snapshot,
      snapshotHash: p.hash,
      providerId: p.providerId,
      publicationState: p.state,
      workflowRunId: p.snapshot.workflowRunId,
      reviewStatus: available
        ? record.latestReportId === p.snapshot.id
          ? record.state
          : 'SUPERSEDED'
        : 'PUBLICATION_FAILED',
      caseRevision: record.revision,
      current: record.latestReportId === p.snapshot.id,
      ...(reviewData ?? {}),
      available,
      ...(available
        ? {
            artifact: {
              id: p.artifactId,
              displayName: p.artifact!.displayName,
              mediaType: p.artifact!.mediaType,
              hash: p.artifact!.hash,
              url: `/insurance/artifacts/${p.artifactId}?caseId=${p.snapshot.caseId}&threadId=${encodeURIComponent(context.threadId)}`,
            },
          }
        : {}),
      ...(failure ? { failure } : {}),
      message: available
        ? record.latestReportId !== p.snapshot.id
          ? 'This historical draft has been superseded and cannot be approved.'
          : record.state === 'FINALIZED'
            ? reviewData?.finalization?.available
              ? 'The reviewed report and all applicable final artifacts are available.'
              : 'The report was finalized, but an artifact is unavailable. Restore the paired database and files; no new approval was inferred.'
            : record.state === 'APPROVED'
              ? 'Broker approval is saved. Final publication is incomplete; retry /report with retryPublication true.'
              : record.state === 'REJECTED'
                ? 'The report was rejected. Its draft and audit remain available; start a new case for further work.'
                : record.state === 'REVISION_REQUESTED'
                  ? 'Revisions were requested. This draft cannot be approved; complete the requested revision first.'
                  : 'Draft available. Broker review of this exact version is still required. No approval or final report has been issued.'
        : 'The saved draft is not available for review. Retry publication after resolving the recorded storage or provider error.',
    };
  }
  return {
    repository,
    review,
    publish,
    current,
    async status(context: OperationContext) {
      const record = await repository.reconciliation.cases.active(context);
      return record?.latestReportId ? current(context, { caseId: record.id }) : null;
    },
    async prepare(context: OperationContext, analysisId: string, runId: string) {
      return repository.prepare(context, analysisId, runId, provider.id);
    },
    async pending(context: OperationContext) {
      return repository.get(context);
    },
  };
}
export type ReportService = ReturnType<typeof createReportService>;
