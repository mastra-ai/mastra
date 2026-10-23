import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { canonicalJson, hashBytes, type OperationContext } from '../domain/contracts.js';
import {
  approvalSchema,
  reviewRequestSchema,
  actionableFindings,
  type Approval,
  type ReviewEvent,
} from '../domain/reviews.js';
import { IntakeError, isDatabaseBusy } from '../domain/errors.js';
import type { ReportRepository } from './reports.js';

export class ReviewRepository {
  constructor(readonly reports: ReportRepository) {}
  async initialize() {
    await this.reports.reconciliation.cases.client.executeMultiple(`
      CREATE TABLE IF NOT EXISTS insurance_review_operations (id TEXT PRIMARY KEY, case_id TEXT NOT NULL REFERENCES insurance_cases(id), digest TEXT NOT NULL, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS insurance_review_events (id TEXT PRIMARY KEY, report_id TEXT NOT NULL REFERENCES insurance_reports(id), case_id TEXT NOT NULL REFERENCES insurance_cases(id), data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS insurance_approvals (id TEXT PRIMARY KEY, report_id TEXT NOT NULL UNIQUE REFERENCES insurance_reports(id), case_id TEXT NOT NULL REFERENCES insurance_cases(id), data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS insurance_finalizations (id TEXT PRIMARY KEY, approval_id TEXT NOT NULL UNIQUE REFERENCES insurance_approvals(id), report_id TEXT NOT NULL UNIQUE REFERENCES insurance_reports(id), case_id TEXT NOT NULL REFERENCES insurance_cases(id), data TEXT NOT NULL);
      INSERT OR IGNORE INTO insurance_schema(version) VALUES(3);
    `);
  }
  async events(context: OperationContext) {
    const record = await this.reports.reconciliation.cases.requireCase(context);
    const rows = await this.reports.reconciliation.cases.client.execute({
      sql: 'SELECT data FROM insurance_review_events WHERE case_id=? ORDER BY rowid',
      args: [record.id],
    });
    return rows.rows.map(row => JSON.parse(String(row.data)) as ReviewEvent);
  }
  async approval(context: OperationContext, reportId: string): Promise<Approval | null> {
    const publication = await this.reports.get(context, reportId);
    if (!publication) return null;
    const row = (
      await this.reports.reconciliation.cases.client.execute({
        sql: 'SELECT data FROM insurance_approvals WHERE report_id=? AND case_id=?',
        args: [reportId, publication.snapshot.caseId],
      })
    ).rows[0];
    if (!row) return null;
    const approval = approvalSchema.parse(JSON.parse(String(row.data)));
    const events = await this.events(context);
    if (
      approval.snapshotHash !== publication.hash ||
      approval.snapshotId !== publication.snapshot.id ||
      approval.version !== publication.snapshot.version ||
      approval.workflowRunId !== publication.snapshot.workflowRunId ||
      approval.threadId !== context.threadId ||
      approval.reviewerId !== context.operatorId ||
      approval.events.some(
        event => !events.some(saved => saved.id === event.id && canonicalJson(saved) === canonicalJson(event)),
      )
    )
      throw new IntakeError(
        'APPROVAL_INTEGRITY',
        'The stored approval no longer matches its report or review audit.',
        'Restore the paired database and artifacts before retrying.',
        409,
      );
    return approval;
  }
  async record(
    context: OperationContext,
    input: unknown,
    origin: { messageId: string; text: string },
    providers: Approval['providers'],
  ) {
    const request = reviewRequestSchema.parse(input);
    z.object({ messageId: z.string().min(1).max(300), text: z.string().startsWith('/review ') }).parse(origin);
    let explicit: unknown;
    try {
      explicit = JSON.parse(origin.text.slice('/review '.length));
    } catch {
      throw new IntakeError(
        'REVIEW_MESSAGE',
        'The explicit review command is invalid.',
        'Submit /review followed by the documented JSON decision.',
      );
    }
    if (canonicalJson(reviewRequestSchema.parse(explicit)) !== canonicalJson(request))
      throw new IntakeError(
        'REVIEW_MESSAGE',
        'The decision does not match the originating user command.',
        'Submit one explicit version-bound /review command.',
        409,
      );
    const digest = hashBytes(canonicalJson({ context, request }));
    return this.reports.reconciliation
      .transaction(async transaction => {
        const record = await this.reports.reconciliation.cases.requireCase(context, request.caseId);
        const replay = (
          await transaction.execute({
            sql: 'SELECT digest,data,case_id FROM insurance_review_operations WHERE id=?',
            args: [request.operationId],
          })
        ).rows[0];
        if (replay) {
          if (String(replay.digest) !== digest || String(replay.case_id) !== record.id)
            throw new IntakeError(
              'REVIEW_REPLAY',
              'This operation identifier was already used for a different decision.',
              'Use a new operation identifier for a new decision.',
              409,
            );
          return JSON.parse(String(replay.data)) as ReviewReceipt;
        }
        const publication = await this.reports.get(context, request.reportId);
        if (
          !publication ||
          publication.snapshot.version !== request.version ||
          publication.hash !== request.snapshotHash ||
          record.latestReportId !== request.reportId ||
          record.revision !== request.expectedRevision ||
          record.state !== request.expectedState ||
          publication.state !== 'PUBLISHED'
        )
          throw new IntakeError(
            'STALE_REVIEW',
            'This report is no longer the current published version awaiting review.',
            'Read /report and submit a decision for the current pending version.',
            409,
          );
        await this.reports.bytes(publication);
        for (const d of request.dispositions)
          if (!publication.snapshot.comparisons.some(f => f.id === d.findingId))
            throw new IntakeError(
              'FINDING_CONTEXT',
              'A named finding is not in this report.',
              'Use the finding identifiers from this exact report version.',
              409,
            );
        const at = new Date().toISOString();
        const common = {
          operationId: request.operationId,
          caseId: record.id,
          reportId: request.reportId,
          reviewerId: context.operatorId,
          threadId: context.threadId,
          messageId: origin.messageId,
          messageHash: hashBytes(origin.text),
          at,
          action: request.action,
        };
        const events: ReviewEvent[] = [
          ...request.dispositions.map(disposition => ({
            ...common,
            id: randomUUID(),
            disposition,
            reason: disposition.reason,
          })),
          { ...common, id: randomUUID(), disposition: null, reason: request.revision?.note ?? request.reason },
        ];
        for (const event of events)
          await transaction.execute({
            sql: 'INSERT INTO insurance_review_events(id,report_id,case_id,data) VALUES(?,?,?,?)',
            args: [event.id, request.reportId, record.id, JSON.stringify(event)],
          });
        let approval: Approval | null = null;
        if (request.action === 'approve') {
          const history = (
            await transaction.execute({
              sql: 'SELECT data FROM insurance_review_events WHERE case_id=? ORDER BY rowid',
              args: [record.id],
            })
          ).rows
            .map(row => JSON.parse(String(row.data)) as ReviewEvent)
            .filter(e => !events.some(newEvent => newEvent.id === e.id));
          const bound = [
            ...history.filter(
              e =>
                e.reportId === request.reportId ||
                (e.disposition && publication.snapshot.comparisons.some(f => f.id === e.disposition!.findingId)),
            ),
            ...events,
          ];
          approval = approvalSchema.parse({
            schemaVersion: 'approval-1',
            id: randomUUID(),
            operationId: request.operationId,
            caseId: record.id,
            snapshotId: request.reportId,
            snapshotHash: request.snapshotHash,
            version: request.version,
            workflowRunId: publication.snapshot.workflowRunId,
            reviewerId: context.operatorId,
            approvedAt: at,
            threadId: context.threadId,
            messageId: origin.messageId,
            messageHash: hashBytes(origin.text),
            events: bound,
            eventSetHash: hashBytes(canonicalJson(bound)),
            providers,
          });
          await transaction.execute({
            sql: 'INSERT INTO insurance_approvals(id,report_id,case_id,data) VALUES(?,?,?,?)',
            args: [approval.id, request.reportId, record.id, JSON.stringify(approval)],
          });
          const stages = [
            'reportOutput',
            ...(actionableFindings(publication.snapshot, approval).length ? ['correctionOutput'] : []),
          ] as const;
          const finalization = {
            id: randomUUID(),
            reportId: request.reportId,
            caseId: record.id,
            approvalId: approval.id,
            state: 'PREPARED',
            artifacts: stages.map(stage => ({
              id: randomUUID(),
              operationId: randomUUID(),
              stage,
              providerId: providers[stage as keyof typeof providers],
              descriptor: null,
            })),
            failure: null,
          };
          await transaction.execute({
            sql: 'INSERT INTO insurance_finalizations(id,approval_id,report_id,case_id,data) VALUES(?,?,?,?,?)',
            args: [finalization.id, approval.id, request.reportId, record.id, JSON.stringify(finalization)],
          });
        }
        const state =
          request.action === 'approve'
            ? 'APPROVED'
            : request.action === 'reject'
              ? 'REJECTED'
              : request.action === 'revise'
                ? 'REVISION_REQUESTED'
                : record.state;
        const updated = {
          ...record,
          state,
          revision: record.revision + 1,
          ...(request.revision
            ? { revisionAuthority: { reportId: request.reportId, eventId: events.at(-1)!.id, ...request.revision } }
            : {}),
        };
        const changed = await transaction.execute({
          sql: 'UPDATE insurance_cases SET data=? WHERE id=? AND data=?',
          args: [JSON.stringify(updated), record.id, JSON.stringify(record)],
        });
        if (changed.rowsAffected !== 1)
          throw new IntakeError(
            'STALE_REVIEW',
            'Another case decision won this review.',
            'Read /report before submitting another decision.',
            409,
          );
        const receipt: ReviewReceipt = {
          operationId: request.operationId,
          caseId: record.id,
          reportId: request.reportId,
          state,
          approvalId: approval?.id ?? null,
          workflowRunId: publication.snapshot.workflowRunId,
          eventIds: events.map(e => e.id),
        };
        await transaction.execute({
          sql: 'INSERT INTO insurance_review_operations(id,case_id,digest,data) VALUES(?,?,?,?)',
          args: [request.operationId, record.id, digest, JSON.stringify(receipt)],
        });
        return receipt;
      })
      .catch(error => {
        if (isDatabaseBusy(error))
          throw new IntakeError(
            'STALE_REVIEW',
            'Another local operation is updating this case; this decision was not recorded.',
            'Read /report after the active operation finishes, then submit the current case revision.',
            409,
          );
        throw error;
      });
  }
}
export type ReviewReceipt = {
  operationId: string;
  caseId: string;
  reportId: string;
  state: string;
  approvalId: string | null;
  workflowRunId: string;
  eventIds: string[];
};
