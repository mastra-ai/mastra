import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { z } from 'zod';
import { outputArtifactSchema, type OperationContext } from '../domain/case-contracts.js';
import { IntakeError, safeFailure } from '../domain/operation-errors.js';
import type { Publication } from '../domain/report-contracts.js';
import { buildReport, reportHash, reportSnapshotSchema } from '../domain/report-contracts.js';
import { ensurePrivateDirectory } from '../runtime/storage-paths.js';
import { artifactBytes, stageArtifact } from './artifact-storage.js';
import type { ReconciliationRepository } from './reconciliation-repository.js';
export class ReportRepository {
  readonly root: string;
  constructor(readonly reconciliation: ReconciliationRepository) {
    this.root = resolve(reconciliation.cases.root, 'reports');
  }
  async initialize() {
    await ensurePrivateDirectory(this.root);
    await this.reconciliation.cases.client.executeMultiple(
      `CREATE TABLE IF NOT EXISTS insurance_reports (id TEXT PRIMARY KEY, case_id TEXT NOT NULL REFERENCES insurance_cases(id), analysis_id TEXT NOT NULL REFERENCES insurance_analysis(id), artifact_id TEXT NOT NULL UNIQUE, data TEXT NOT NULL); INSERT OR IGNORE INTO insurance_schema(version) VALUES(2);`,
    );
    await this.migrateRevisions();
  }
  async migrateRevisions() {
    const row = (
      await this.reconciliation.cases.client.execute("SELECT sql FROM sqlite_master WHERE name='insurance_reports'")
    ).rows[0];
    if (!String(row?.sql).includes('analysis_id TEXT NOT NULL UNIQUE')) return;
    await this.reconciliation.transaction(async transaction => {
      await transaction.execute(
        'CREATE TABLE insurance_reports_revision (id TEXT PRIMARY KEY, case_id TEXT NOT NULL REFERENCES insurance_cases(id), analysis_id TEXT NOT NULL REFERENCES insurance_analysis(id), artifact_id TEXT NOT NULL UNIQUE, data TEXT NOT NULL)',
      );
      await transaction.execute('INSERT INTO insurance_reports_revision SELECT * FROM insurance_reports');
      await transaction.execute('DROP TABLE insurance_reports');
      await transaction.execute('ALTER TABLE insurance_reports_revision RENAME TO insurance_reports');
    });
  }
  async prepare(context: OperationContext, analysisId: string, runId: string, providerId: string) {
    return this.reconciliation.transaction(async transaction => {
      const record = await this.reconciliation.cases.requireCase(context);
      const existing = (
        await transaction.execute({
          sql: "SELECT data FROM insurance_reports WHERE json_extract(data,'$.snapshot.workflowRunId')=? AND case_id=?",
          args: [runId, record.id],
        })
      ).rows[0];
      if (existing) return this.validate(JSON.parse(String(existing.data)) as Publication);
      if (record.state !== 'PROCESSING')
        throw new IntakeError(
          'REPORT_AUTHORITY',
          'A new report requires completed processing or an explicitly requested revision bound to this workflow.',
          'Read the current report; request a revision before creating another version.',
          409,
        );
      const { analyses, attempts } = await this.reconciliation.status(context);
      const analysis = analyses.find(a => a.id === analysisId);
      if (
        !analysis ||
        record.latestAnalysisId !== analysisId ||
        !(record.revisionAuthority?.kind === 'presentation'
          ? record.revisionAuthority.runId === runId
          : attempts.some(
              attempt => attempt.id === analysis.attemptId && attempt.runId === runId && attempt.state === 'COMPLETED',
            ))
      )
        throw new IntakeError(
          'REPORT_CONTEXT',
          'The analysis is not the current case result.',
          'Read case status before requesting a draft.',
          409,
        );
      const previous = (
        await transaction.execute({
          sql: 'SELECT COUNT(*) AS count FROM insurance_reports WHERE case_id=?',
          args: [record.id],
        })
      ).rows[0]!;
      const snapshot = buildReport(analysis, randomUUID(), Number(previous.count) + 1, runId);
      if (record.revisionAuthority) {
        snapshot.revisionNote = record.revisionAuthority.note;
        const events = await transaction.execute({
          sql: 'SELECT data FROM insurance_review_events WHERE case_id=? ORDER BY rowid',
          args: [record.id],
        });
        snapshot.reviewHistory = events.rows
          .map(row => JSON.parse(String(row.data)) as import('../domain/review-contracts.js').ReviewEvent)
          .filter(e => e.disposition && snapshot.comparisons.some(f => f.id === e.disposition!.findingId));
      }
      const publication: Publication = {
        snapshot,
        hash: reportHash(snapshot),
        operationId: randomUUID(),
        artifactId: randomUUID(),
        providerId,
        context: structuredClone(context),
        state: 'PREPARED',
        artifact: null,
        failure: null,
      };
      await transaction.execute({
        sql: 'INSERT INTO insurance_reports(id,case_id,analysis_id,artifact_id,data) VALUES(?,?,?,?,?)',
        args: [snapshot.id, record.id, analysisId, publication.artifactId, JSON.stringify(publication)],
      });
      const updated = {
        ...record,
        revisionAuthority: undefined,
        latestReportId: snapshot.id,
        state: 'PROCESSING',
        revision: record.revision + 1,
      };
      await transaction.execute({
        sql: 'UPDATE insurance_cases SET data=? WHERE id=? AND data=?',
        args: [JSON.stringify(updated), record.id, JSON.stringify(record)],
      });
      return publication;
    });
  }
  validate(publication: Publication) {
    reportSnapshotSchema.parse(publication.snapshot);
    if (reportHash(publication.snapshot) !== publication.hash)
      throw new IntakeError(
        'REPORT_INTEGRITY',
        'The saved report no longer matches its immutable checksum.',
        'Restore the matching database and files with the server stopped.',
        409,
      );
    return publication;
  }
  async forRun(runId: string) {
    const row = (
      await this.reconciliation.cases.client.execute({
        sql: "SELECT data FROM insurance_reports WHERE json_extract(data,'$.snapshot.workflowRunId')=?",
        args: [runId],
      })
    ).rows[0];
    if (!row) return null;
    const p = this.validate(JSON.parse(String(row.data)) as Publication);
    return this.get(p.context, p.snapshot.id);
  }
  async get(context: OperationContext, id?: string): Promise<Publication | null> {
    const record = await this.reconciliation.cases.requireCase(context);
    const row = (
      await this.reconciliation.cases.client.execute({
        sql: 'SELECT data FROM insurance_reports WHERE id=? AND case_id=?',
        args: [id ?? record.latestReportId ?? '', record.id],
      })
    ).rows[0];
    if (!row) return null;
    const p = this.validate(JSON.parse(String(row.data)) as Publication);
    if (p.context.operatorId !== context.operatorId || p.context.threadId !== context.threadId)
      throw new IntakeError(
        'REPORT_CONTEXT',
        'This report is not associated with the current operator and conversation.',
        'Use its original conversation.',
        403,
      );
    return p;
  }
  async update(p: Publication, artifact: z.infer<typeof outputArtifactSchema> | null, error?: unknown) {
    return this.reconciliation.transaction(async transaction => {
      const record = await this.reconciliation.cases.requireCase(p.context, p.snapshot.caseId);
      const current = await this.get(p.context, p.snapshot.id);
      if (!current)
        throw new IntakeError('REPORT_CONTEXT', 'The report publication is unavailable.', 'Read case status.', 409);
      if (current.state === 'PUBLISHED') return current;
      const updated: Publication = {
        ...current,
        state: artifact ? 'PUBLISHED' : 'FAILED',
        artifact,
        failure: artifact ? null : safeFailure(error),
      };
      await transaction.execute({
        sql: 'UPDATE insurance_reports SET data=? WHERE id=? AND data=?',
        args: [JSON.stringify(updated), p.snapshot.id, JSON.stringify(current)],
      });
      if (record.latestReportId === p.snapshot.id && ['PROCESSING', 'FAILED'].includes(record.state))
        await transaction.execute({
          sql: 'UPDATE insurance_cases SET data=? WHERE id=? AND data=?',
          args: [
            JSON.stringify({
              ...record,
              state: artifact ? 'AWAITING_REVIEW' : 'FAILED',
              revision: record.revision + 1,
            }),
            record.id,
            JSON.stringify(record),
          ],
        });
      return updated;
    });
  }
  verifyBinding(p: Publication, descriptor: z.infer<typeof outputArtifactSchema>) {
    const a = outputArtifactSchema.parse(descriptor);
    if (
      a.providerId !== p.providerId ||
      a.stage !== 'draftOutput' ||
      a.snapshotId !== p.snapshot.id ||
      a.snapshotHash !== p.hash ||
      a.operationId !== p.operationId ||
      a.approvalId
    )
      throw new IntakeError(
        'ARTIFACT_BINDING',
        'The output does not match the frozen draft publication.',
        'Correct the selected output provider and retry the same report.',
        409,
      );
    return a;
  }
  async stage(p: Publication, descriptor: z.infer<typeof outputArtifactSchema>, bytes: Uint8Array) {
    const artifact = this.verifyBinding(p, descriptor);
    await this.reconciliation.transaction(async () => {
      const current = await this.get(p.context, p.snapshot.id);
      if (!current)
        throw new IntakeError('REPORT_CONTEXT', 'The report publication is unavailable.', 'Read case status.', 409);
      if (current.state === 'PUBLISHED') {
        await this.bytes(current);
        if (current.artifact?.hash !== artifact.hash)
          throw new IntakeError(
            'ARTIFACT_BINDING',
            'This report already has different published bytes.',
            'Retrieve the existing immutable draft.',
            409,
          );
        return;
      }
      await stageArtifact(this.root, p.artifactId, artifact.hash, bytes);
    });
  }
  async bytes(p: Publication, descriptor = p.artifact) {
    if (!descriptor)
      throw new IntakeError(
        'ARTIFACT_UNPUBLISHED',
        'The draft has not been published.',
        'Retry publication of the saved report.',
        409,
      );
    const artifact = this.verifyBinding(p, descriptor);
    return artifactBytes(this.root, p.artifactId, artifact.hash);
  }
  async download(context: OperationContext, caseId: string, artifactId: string) {
    z.uuid().parse(caseId);
    z.uuid().parse(artifactId);
    await this.reconciliation.cases.requireCase(context, caseId);
    const row = (
      await this.reconciliation.cases.client.execute({
        sql: 'SELECT id FROM insurance_reports WHERE case_id=? AND artifact_id=?',
        args: [caseId, artifactId],
      })
    ).rows[0];
    const p = row ? await this.get(context, String(row.id)) : null;
    if (!p || p.state !== 'PUBLISHED')
      throw new IntakeError(
        'ARTIFACT_CONTEXT',
        'No published draft matches this case and conversation.',
        'Read /report in its original conversation.',
        404,
      );
    return { bytes: await this.bytes(p), artifact: p.artifact! };
  }
}
