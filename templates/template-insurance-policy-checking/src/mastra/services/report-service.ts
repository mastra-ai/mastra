import { outputArtifactSchema, hashBytes, type OperationContext, type OutputProvider } from '../domain/contracts.js';
import { draftOutputRequestSchema } from '../domain/output-contracts.js';
import { reportRequestSchema } from '../domain/reports.js';
import { IntakeError, safeFailure } from '../domain/errors.js';
import type { ReportRepository, Publication } from '../storage/reports.js';

export function createReportService(repository: ReportRepository, provider: OutputProvider<'draftOutput'>) {
  async function publish(publication: Publication) {
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
      return await repository.update(publication, artifact);
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
      reviewStatus: available ? 'AWAITING_REVIEW' : 'PUBLICATION_FAILED',
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
        ? 'Draft available. Broker review of this exact version is still required. No approval or final report has been issued.'
        : 'The saved draft is not available for review. Retry publication after resolving the recorded storage or provider error.',
    };
  }
  return {
    repository,
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
