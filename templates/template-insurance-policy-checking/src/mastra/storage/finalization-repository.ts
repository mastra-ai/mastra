import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { canonicalJson, outputArtifactSchema, type OperationContext } from '../domain/case-contracts.js';
import { IntakeError, safeFailure } from '../domain/operation-errors.js';
import type { ReportSnapshot } from '../domain/report-contracts.js';
import type { FinalArtifact, Finalization } from '../domain/output-contracts.js';
import { actionableFindings, type Approval } from '../domain/review-contracts.js';
import { artifactBytes, stageArtifact } from './artifact-storage.js';
import type { ReviewRepository } from './review-repository.js';

type Descriptor = z.infer<typeof outputArtifactSchema>;
export class FinalizationRepository {
  constructor(readonly reviews: ReviewRepository) {}
  get reports() {
    return this.reviews.reports;
  }
  async initialize() {
    await this.reports.reconciliation.cases.client.execute(
      'CREATE TABLE IF NOT EXISTS insurance_finalizations (id TEXT PRIMARY KEY, approval_id TEXT NOT NULL UNIQUE REFERENCES insurance_approvals(id), report_id TEXT NOT NULL UNIQUE REFERENCES insurance_reports(id), case_id TEXT NOT NULL REFERENCES insurance_cases(id), data TEXT NOT NULL)',
    );
  }
  async get(context: OperationContext, reportId: string): Promise<Finalization | null> {
    const record = await this.reports.reconciliation.cases.requireCase(context);
    const row = (
      await this.reports.reconciliation.cases.client.execute({
        sql: 'SELECT data FROM insurance_finalizations WHERE report_id=? AND case_id=?',
        args: [reportId, record.id],
      })
    ).rows[0];
    return row ? (JSON.parse(String(row.data)) as Finalization) : null;
  }
  async authority(context: OperationContext, reportId: string, expected?: Approval) {
    const record = await this.reports.reconciliation.cases.requireCase(context);
    const publication = await this.reports.get(context, reportId);
    const approval = await this.reviews.approval(context, reportId);
    if (
      !publication ||
      !approval ||
      record.latestReportId !== reportId ||
      !['APPROVED', 'FINALIZED'].includes(record.state) ||
      (expected && canonicalJson(expected) !== canonicalJson(approval))
    )
      throw new IntakeError(
        'APPROVAL_REQUIRED',
        'This exact current report has no recorded broker approval for finalization.',
        'Submit an explicit /review approval of the published pending version.',
        409,
      );
    await this.reports.bytes(publication);
    return { publication, approval, record };
  }
  /** Reserve the same approved output stages and immutable artifact identities in either publication path. */
  static reservation(snapshot: ReportSnapshot, approval: Approval): Finalization {
    const stages: ('reportOutput' | 'correctionOutput')[] = [
      'reportOutput',
      ...(actionableFindings(snapshot, approval).length ? ['correctionOutput' as const] : []),
    ];
    return {
      id: randomUUID(),
      reportId: snapshot.id,
      caseId: snapshot.caseId,
      approvalId: approval.id,
      state: 'PREPARED',
      artifacts: stages.map(stage => ({
        id: randomUUID(),
        operationId: randomUUID(),
        stage,
        providerId: approval.providers[stage],
        descriptor: null,
      })),
      failure: null,
    };
  }
  async prepare(context: OperationContext, reportId: string) {
    return this.reports.reconciliation.transaction(async transaction => {
      const { publication, approval } = await this.authority(context, reportId);
      const existing = await this.get(context, reportId);
      if (existing) return existing;
      const result = FinalizationRepository.reservation(publication.snapshot, approval);
      await transaction.execute({
        sql: 'INSERT INTO insurance_finalizations(id,approval_id,report_id,case_id,data) VALUES(?,?,?,?,?)',
        args: [result.id, approval.id, reportId, result.caseId, JSON.stringify(result)],
      });
      return result;
    });
  }
  binding(artifact: FinalArtifact, descriptor: Descriptor, approval: Approval) {
    const a = outputArtifactSchema.parse(descriptor);
    if (
      a.operationId !== artifact.operationId ||
      a.providerId !== artifact.providerId ||
      a.stage !== artifact.stage ||
      a.snapshotId !== approval.snapshotId ||
      a.snapshotHash !== approval.snapshotHash ||
      a.approvalId !== approval.id
    )
      throw new IntakeError(
        'ARTIFACT_BINDING',
        'The output does not match the frozen approved publication.',
        'Correct the selected provider and retry the same approval.',
        409,
      );
    return a;
  }
  async save(
    context: OperationContext,
    reportId: string,
    artifactId: string,
    descriptor: Descriptor,
    bytes: Uint8Array,
  ) {
    return this.reports.reconciliation.transaction(async transaction => {
      const { approval } = await this.authority(context, reportId);
      const current = (await this.get(context, reportId))!;
      const artifact = current.artifacts.find(a => a.id === artifactId);
      if (!artifact)
        throw new IntakeError(
          'ARTIFACT_BINDING',
          'The final artifact identity is not reserved.',
          'Read the saved approved publication.',
          409,
        );
      this.binding(artifact, descriptor, approval);
      if (artifact.descriptor) {
        await artifactBytes(this.reports.root, artifact.id, artifact.descriptor.hash);
        if (canonicalJson(artifact.descriptor) !== canonicalJson(descriptor))
          throw new IntakeError(
            'ARTIFACT_BINDING',
            'The final artifact already has different published bytes.',
            'Retrieve the existing immutable final artifact.',
            409,
          );
        return current;
      }
      await stageArtifact(this.reports.root, artifact.id, descriptor.hash, bytes);
      artifact.descriptor = descriptor;
      current.failure = null;
      await transaction.execute({
        sql: 'UPDATE insurance_finalizations SET data=? WHERE id=?',
        args: [JSON.stringify(current), current.id],
      });
      return current;
    });
  }
  async finish(context: OperationContext, reportId: string) {
    return this.reports.reconciliation.transaction(async transaction => {
      const { record, approval } = await this.authority(context, reportId);
      const current = (await this.get(context, reportId))!;
      for (const artifact of current.artifacts) {
        if (!artifact.descriptor)
          throw new IntakeError(
            'FINALIZATION_INCOMPLETE',
            'Some approved output is still unpublished.',
            'Retry /report with retryPublication true.',
            409,
          );
        this.binding(artifact, artifact.descriptor, approval);
        await artifactBytes(this.reports.root, artifact.id, artifact.descriptor.hash);
      }
      current.state = 'PUBLISHED';
      current.failure = null;
      await transaction.execute({
        sql: 'UPDATE insurance_finalizations SET data=? WHERE id=?',
        args: [JSON.stringify(current), current.id],
      });
      if (record.state !== 'FINALIZED')
        await transaction.execute({
          sql: 'UPDATE insurance_cases SET data=? WHERE id=? AND data=?',
          args: [
            JSON.stringify({ ...record, state: 'FINALIZED', revision: record.revision + 1 }),
            record.id,
            JSON.stringify(record),
          ],
        });
      return current;
    });
  }
  async fail(context: OperationContext, reportId: string, error: unknown) {
    await this.reports.reconciliation.transaction(async transaction => {
      const current = await this.get(context, reportId);
      if (current && current.state !== 'PUBLISHED')
        await transaction.execute({
          sql: 'UPDATE insurance_finalizations SET data=? WHERE id=?',
          args: [JSON.stringify({ ...current, failure: safeFailure(error) }), current.id],
        });
    });
  }
  async download(context: OperationContext, caseId: string, artifactId: string) {
    const record = await this.reports.reconciliation.cases.requireCase(context, caseId);
    const rows = await this.reports.reconciliation.cases.client.execute({
      sql: 'SELECT data FROM insurance_finalizations WHERE case_id=?',
      args: [record.id],
    });
    for (const row of rows.rows) {
      const finalization = JSON.parse(String(row.data)) as Finalization;
      const artifact = finalization.artifacts.find(a => a.id === artifactId);
      if (!artifact || finalization.state !== 'PUBLISHED' || !artifact.descriptor) continue;
      const { approval } = await this.authority(context, finalization.reportId);
      this.binding(artifact, artifact.descriptor, approval);
      // A final set is available only while every applicable file remains durable.
      for (const member of finalization.artifacts)
        await artifactBytes(this.reports.root, member.id, member.descriptor!.hash);
      return {
        bytes: await artifactBytes(this.reports.root, artifact.id, artifact.descriptor.hash),
        artifact: artifact.descriptor,
      };
    }
    throw new IntakeError(
      'ARTIFACT_CONTEXT',
      'No published final artifact matches this case and conversation.',
      'Read /report in its original conversation.',
      404,
    );
  }
}
