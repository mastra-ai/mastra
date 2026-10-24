import type { Transaction } from '@libsql/client';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { canonicalJson, hashBytes, type OperationContext } from '../domain/case-contracts.js';
import { naturalReviewRequest } from '../domain/conversation-commands.js';
import { IntakeError, isDatabaseBusy } from '../domain/operation-errors.js';
import type { ReviewReceipt } from '../domain/review-contracts.js';
import {
  actionableFindings,
  approvalSchema,
  reviewRequestSchema,
  type Approval,
  type ReviewEvent,
} from '../domain/review-contracts.js';
import type { ReportRepository } from './report-repository.js';

export class ReviewRepository {
  constructor(readonly reports: ReportRepository) {}
  async initialize() {
    await this.reports.reconciliation.cases.client.executeMultiple(`
      CREATE TABLE IF NOT EXISTS insurance_review_operations (id TEXT PRIMARY KEY, case_id TEXT NOT NULL REFERENCES insurance_cases(id), digest TEXT NOT NULL, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS insurance_review_events (id TEXT PRIMARY KEY, report_id TEXT NOT NULL REFERENCES insurance_reports(id), case_id TEXT NOT NULL REFERENCES insurance_cases(id), data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS insurance_approvals (id TEXT PRIMARY KEY, report_id TEXT NOT NULL UNIQUE REFERENCES insurance_reports(id), case_id TEXT NOT NULL REFERENCES insurance_cases(id), data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS insurance_finalizations (id TEXT PRIMARY KEY, approval_id TEXT NOT NULL UNIQUE REFERENCES insurance_approvals(id), report_id TEXT NOT NULL UNIQUE REFERENCES insurance_reports(id), case_id TEXT NOT NULL REFERENCES insurance_cases(id), data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS insurance_review_messages (operator_id TEXT NOT NULL, thread_id TEXT NOT NULL, message_id TEXT NOT NULL, message_hash TEXT NOT NULL, operation_id TEXT NOT NULL REFERENCES insurance_review_operations(id), request TEXT NOT NULL, PRIMARY KEY(operator_id,thread_id,message_id));
      INSERT OR IGNORE INTO insurance_schema(version) VALUES(3);
      INSERT OR IGNORE INTO insurance_schema(version) VALUES(4);
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
  private async savedMessage(
    context: OperationContext,
    origin: { messageId: string; text: string },
    transaction?: Transaction,
  ) {
    const database = transaction ?? this.reports.reconciliation.cases.client;
    const saved = (
      await database.execute({
        sql: 'SELECT message_hash,request FROM insurance_review_messages WHERE operator_id=? AND thread_id=? AND message_id=?',
        args: [context.operatorId, context.threadId, origin.messageId],
      })
    ).rows[0];
    if (!saved) return null;
    if (String(saved.message_hash) !== hashBytes(origin.text))
      throw new IntakeError(
        'REVIEW_MESSAGE',
        'This saved message already authorized a different decision.',
        'Send a new message for a different review decision.',
        409,
      );
    return reviewRequestSchema.parse(JSON.parse(String(saved.request)));
  }
  private async resolveNatural(context: OperationContext, origin: { messageId: string; text: string }) {
    const saved = await this.savedMessage(context, origin);
    if (saved) return saved;
    const record = await this.reports.reconciliation.cases.requireCase(context);
    const publication = await this.reports.get(context);
    if (!publication || publication.state !== 'PUBLISHED' || record.state !== 'AWAITING_REVIEW')
      throw new IntakeError('STALE_REVIEW', 'There is no current published report awaiting this review.');
    return naturalReviewRequest(origin.text, publication.snapshot, publication.hash, record.revision, randomUUID());
  }
  async record(
    context: OperationContext,
    input: unknown,
    origin: { messageId: string; text: string },
    providers: Approval['providers'],
  ) {
    z.object({
      messageId: z
        .string()
        .min(1)
        .max(300)
        .describe('Identifier of the original user message authorizing this decision.'),
      text: z.string().min(1).describe('Exact original user text authorizing this version-bound review.'),
    }).parse(origin);
    const natural = typeof input === 'string';
    if (natural && input !== origin.text)
      throw new IntakeError('REVIEW_MESSAGE', 'The decision does not match the originating user command.');
    const request = natural ? await this.resolveNatural(context, origin) : reviewRequestSchema.parse(input);
    let explicit: unknown;
    if (origin.text.startsWith('/review ')) {
      try {
        explicit = JSON.parse(origin.text.slice('/review '.length));
      } catch {
        throw new IntakeError(
          'REVIEW_MESSAGE',
          'The explicit review command is invalid.',
          'Submit one explicit decision for the current report version.',
        );
      }
    } else {
      const publication = await this.reports.get(context, request.reportId);
      if (!publication)
        throw new IntakeError(
          'REVIEW_MESSAGE',
          'This report is unavailable.',
          'Show the current report before reviewing it.',
        );
      explicit = naturalReviewRequest(
        origin.text,
        publication.snapshot,
        publication.hash,
        request.expectedRevision,
        request.operationId,
      );
    }
    if (canonicalJson(reviewRequestSchema.parse(explicit)) !== canonicalJson(request))
      throw new IntakeError(
        'REVIEW_MESSAGE',
        'The decision does not match the originating user command.',
        'Submit one explicit decision for the current report version.',
        409,
      );
    const digest = hashBytes(canonicalJson({ context, request }));
    return this.reports.reconciliation
      .transaction(async transaction => {
        const record = await this.reports.reconciliation.cases.requireCase(context, request.caseId);
        // Recheck message identity under the writer lock: simultaneous retries may
        // have resolved before the first decision was committed.
        const savedMessage = await this.savedMessage(context, origin, transaction);
        if (savedMessage) {
          if (!natural && canonicalJson(savedMessage) !== canonicalJson(request))
            throw new IntakeError('REVIEW_MESSAGE', 'The decision does not match this saved user message.');
          const savedOperation = (
            await transaction.execute({
              sql: 'SELECT digest,data FROM insurance_review_operations WHERE id=? AND case_id=?',
              args: [savedMessage.operationId, record.id],
            })
          ).rows[0];
          if (
            !savedOperation ||
            String(savedOperation.digest) !== hashBytes(canonicalJson({ context, request: savedMessage }))
          )
            throw new IntakeError(
              'REVIEW_MESSAGE',
              'The saved review request no longer matches its recorded decision.',
            );
          return JSON.parse(String(savedOperation.data)) as ReviewReceipt;
        }
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
        if (!origin.text.startsWith('/review '))
          await transaction.execute({
            sql: 'INSERT INTO insurance_review_messages(operator_id,thread_id,message_id,message_hash,operation_id,request) VALUES(?,?,?,?,?,?)',
            args: [
              context.operatorId,
              context.threadId,
              origin.messageId,
              hashBytes(origin.text),
              request.operationId,
              JSON.stringify(request),
            ],
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
