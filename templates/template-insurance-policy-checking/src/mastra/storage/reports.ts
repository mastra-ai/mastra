import { randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { open, unlink, realpath, lstat, link, rename } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { z } from 'zod';
import { outputArtifactSchema, hashBytes, type OperationContext } from '../domain/contracts.js';
import { buildReport, reportSnapshotSchema, reportHash, type ReportSnapshot } from '../domain/reports.js';
import { IntakeError, safeFailure, type Failure } from '../domain/errors.js';
import { ensurePrivateDirectory } from '../runtime/paths.js';
import type { ReconciliationRepository } from './reconciliation.js';

export type Publication = {
  snapshot: ReportSnapshot;
  hash: string;
  operationId: string;
  artifactId: string;
  providerId: string;
  context: OperationContext;
  state: 'PREPARED' | 'FAILED' | 'PUBLISHED';
  artifact: z.infer<typeof outputArtifactSchema> | null;
  failure: Failure | null;
};
export class ReportRepository {
  readonly root: string;
  constructor(readonly reconciliation: ReconciliationRepository) {
    this.root = resolve(reconciliation.cases.root, 'reports');
  }
  async initialize() {
    await ensurePrivateDirectory(this.root);
    await this.reconciliation.cases.client.executeMultiple(
      `CREATE TABLE IF NOT EXISTS insurance_reports (id TEXT PRIMARY KEY, case_id TEXT NOT NULL REFERENCES insurance_cases(id), analysis_id TEXT NOT NULL UNIQUE REFERENCES insurance_analysis(id), artifact_id TEXT NOT NULL UNIQUE, data TEXT NOT NULL); INSERT OR IGNORE INTO insurance_schema(version) VALUES(2);`,
    );
  }
  async prepare(context: OperationContext, analysisId: string, runId: string, providerId: string) {
    return this.reconciliation.transaction(async transaction => {
      const record = await this.reconciliation.cases.requireCase(context);
      const existing = (
        await transaction.execute({
          sql: 'SELECT data FROM insurance_reports WHERE analysis_id=? AND case_id=?',
          args: [analysisId, record.id],
        })
      ).rows[0];
      if (existing) return this.validate(JSON.parse(String(existing.data)) as Publication);
      const { analyses } = await this.reconciliation.status(context);
      const analysis = analyses.find(a => a.id === analysisId);
      if (!analysis || record.latestAnalysisId !== analysisId)
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
      const updated = { ...record, latestReportId: snapshot.id, state: 'PROCESSING', revision: record.revision + 1 };
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
      await transaction.execute({
        sql: 'UPDATE insurance_cases SET data=? WHERE id=? AND data=?',
        args: [
          JSON.stringify({ ...record, state: artifact ? 'AWAITING_REVIEW' : 'FAILED', revision: record.revision + 1 }),
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
    const path = resolve(this.root, p.artifactId + '-' + artifact.hash);
    const temporary = path + '.staging-' + randomUUID();
    // Only complete, synced byte sets acquire the immutable destination name.
    // Interrupted temporary files remain private recovery evidence.
    const file = await open(temporary, 'wx', 0o600);
    try {
      await file.writeFile(bytes);
      await file.sync();
    } finally {
      await file.close();
    }
    const syncDirectory = async () => {
      const directory = await open(this.root, 'r');
      try {
        await directory.sync();
      } finally {
        await directory.close();
      }
    };
    try {
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
        try {
          await link(temporary, path);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
          try {
            await this.bytes(p, descriptor);
            await syncDirectory();
            return;
          } catch {
            // The database write lock excludes publication while repairing a legacy
            // incomplete destination. Retain its bytes instead of erasing history.
            await rename(path, path + '.interrupted-' + randomUUID());
            await link(temporary, path);
          }
        }
        await syncDirectory();
      });
    } finally {
      await unlink(temporary);
      await syncDirectory();
    }
  }
  async bytes(p: Publication, descriptor = p.artifact) {
    if (!descriptor)
      throw new IntakeError(
        'ARTIFACT_UNPUBLISHED',
        'The draft has not been published.',
        'Retry publication of the saved report.',
        409,
      );
    const a = this.verifyBinding(p, descriptor);
    try {
      const root = await realpath(this.root);
      const path = resolve(root, p.artifactId + '-' + a.hash);
      if (!path.startsWith(root + sep) || !z.uuid().safeParse(p.artifactId).success) throw Error('Invalid location');
      const entry = await lstat(path);
      if (!entry.isFile() || entry.isSymbolicLink() || (await realpath(path)) !== path) throw Error('Invalid file');
      const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
      try {
        const bytes = await file.readFile();
        if (hashBytes(bytes) !== a.hash || !bytes.length) throw Error('Invalid checksum');
        return bytes;
      } finally {
        await file.close();
      }
    } catch {
      throw new IntakeError(
        'ARTIFACT_UNAVAILABLE',
        'The saved draft is missing, incomplete or no longer matches its checksum.',
        'Check private storage and restore the paired database and files before retrying.',
        409,
      );
    }
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
