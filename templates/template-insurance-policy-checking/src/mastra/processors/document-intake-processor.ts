import { parseMemoryRequestContext } from '@mastra/core/memory';
import type { InputProcessor } from '@mastra/core/processors';
import type { Memory } from '@mastra/memory';
import { z } from 'zod';
import { defaultInsuranceProfile } from '../config/insurance-config.js';
import { parseNamedClarification, parseNaturalReview } from '../domain/conversation-commands.js';
import { IntakeError } from '../domain/operation-errors.js';
import type { ComparisonRunner } from '../domain/reconciliation-contracts.js';
import type { ReviewDecision } from '../domain/review-contracts.js';
import type { CaseService } from '../services/case-service.js';
import type { ReportReader } from '../tools/report-tool.js';
import { conversationFailure, statusNotice } from './conversation-notices.js';
import { finalReportAvailable, markdown, reportNotice } from './report-notice-formatter.js';
import { createLocalResponseModel } from './local-response-model.js';

export const workingMemorySchema = z.object({
  activeCaseId: z
    .string()
    .nullable()
    .describe('Convenience identifier of the active case; persisted case records remain authoritative.'),
  activePolicyNumber: z
    .string()
    .nullable()
    .describe('Policy number copied from the active case, or null when unknown.'),
  insuredName: z.string().nullable().describe('Insured person or organization as documented; null when unknown.'),
  insuranceProduct: z.string().nullable().describe('Insurance product or line of business; null when unknown.'),
  documentIds: z.array(z.string()).describe('Captured source identifiers belonging to the active case.'),
  workflowRunId: z.string().nullable().describe('Native Mastra workflow run bound to this analysis or report.'),
  draftReportId: z
    .string()
    .nullable()
    .describe('Identifier of the currently available draft; null before verified publication.'),
  draftVersion: z.number().nullable().describe('Currently available draft version; null before verified publication.'),
  reviewStatus: z
    .string()
    .nullable()
    .describe('Persisted broker review state, separate from the analytical conclusion.'),
});

/** Capture attachments privately and route explicit broker commands through case services. */
export function createDocumentIntakeProcessor(
  caseService: CaseService,
  memory: Memory,
  operatorId: string,
  allowControlledModel: boolean,
  comparison?: ComparisonRunner,
  report?: ReportReader,
  review?: ReviewDecision,
): InputProcessor {
  return {
    id: 'private-document-intake',
    async processInput({ messages, messageList, requestContext, state }) {
      // The native agent loop owns streaming and history persistence for local replies too.
      const sanitized = messages.map(message => ({
        ...message,
        content: { ...message.content, parts: message.content.parts.filter(part => part.type !== 'file') },
      }));
      try {
        const latest = [...messageList.get.input.db()]
          .reverse()
          .find(message => message.role === 'user' || (message.role === 'signal' && message.type === 'user'));
        const memoryContext = parseMemoryRequestContext(requestContext);
        const threadId = caseService.requireThread(memoryContext?.thread?.id ?? latest?.threadId);
        const context = { threadId, operatorId };
        requestContext?.set('insuranceThreadId', threadId);
        const parts = latest?.content.parts ?? [];
        const files = parts
          .filter(part => part.type === 'file')
          .map(part => ({
            name: 'filename' in part && typeof part.filename === 'string' ? part.filename : 'attachment.pdf',
            data: part.data,
          }));
        const text = parts
          .filter(part => part.type === 'text')
          .map(part => part.text)
          .join('\n');
        let notice: string | undefined;
        const naturalReview = parseNaturalReview(text);
        const reviewCommand = /^\/review(?:\s|$)/.test(text) || Boolean(naturalReview);
        const normalized = text.trim();
        if (/^(?:Approve report|Revise report|Confirm finding)\b/i.test(normalized) && !naturalReview)
          throw new IntakeError('REVIEW_COMMAND', 'The review instruction is ambiguous.');
        const sourcesByName = async (name: string) => {
          const matches = (await caseService.repository.sources(context)).filter(source => source.displayName === name);
          if (matches.length !== 1)
            throw new IntakeError(
              'SOURCE_NAME',
              'That filename does not identify exactly one saved document.',
              'Show status and use the exact unique filename. Rename ambiguous documents and attach them in a new conversation.',
            );
          return matches[0]!;
        };
        if (reviewCommand) {
          if (!review || !latest?.id || files.length)
            throw new IntakeError('REVIEW_COMMAND', 'Review needs one explicit user command without attachments.');
          let input: unknown;
          if (naturalReview) {
            // The review boundary resolves saved message authority before checking
            // current report state, so retries retain the exact original request.
            input = text;
          } else {
            try {
              input = JSON.parse(text.slice('/review '.length));
            } catch {
              throw new IntakeError('REVIEW_COMMAND', 'The review command is invalid.');
            }
          }
          const result = await review(context, input, { messageId: latest.id, text });
          const value = result as { report: unknown; receipt: { state: string }; publicationFailure?: unknown };
          notice = `${['FINALIZED', 'APPROVED'].includes(value.receipt.state) ? (finalReportAvailable(value.report) ? 'I’ve issued your final report' : 'I’ve saved your approval') : value.receipt.state === 'REJECTED' ? 'I’ve saved your rejection' : value.receipt.state === 'REVISION_REQUESTED' ? 'I’ve saved your review note' : 'I’ve saved your finding confirmation'}.\n\n${reportNotice(value.report, context, true)}`;
          if (value.publicationFailure)
            notice +=
              '\n\nApproval is saved, but final publication is incomplete. Show the report to check availability before retrying.';
        }
        if (text.startsWith('/case ')) {
          const caseId = z.uuid().parse(text.slice('/case '.length).trim());
          await caseService.repository.select(context, caseId);
        }
        if (files.length) {
          await caseService.capture(context, { files }, normalized === '/new');
        }
        const namedClarification = parseNamedClarification(text);
        if (namedClarification) {
          const record = await caseService.repository.requireCase(context);
          const reference = await sourcesByName(namedClarification.reference);
          const target = await sourcesByName(namedClarification.target);
          const roles = [
            { sourceId: reference.sourceId, role: namedClarification.referenceRole },
            { sourceId: target.sourceId, role: 'issued_policy' },
          ];
          for (const role of namedClarification.roles)
            roles.push({ sourceId: (await sourcesByName(role.name)).sourceId, role: role.role });
          await caseService.clarify(context, {
            caseId: record.id,
            expectedRevision: record.revision,
            identity: namedClarification.identity,
            intent: 'agreed_terms_checking',
            referenceId: reference.sourceId,
            targetId: target.sourceId,
            roles,
            acceptedBaseline: { sourceId: reference.sourceId, statement: text },
          });
          notice =
            "I've saved the proposal or contract you accepted, the issued policy, and your policy details. Say “Compare the documents” to prepare the report.";
        } else if (text.startsWith('/clarify ')) {
          let clarification: unknown;
          try {
            clarification = JSON.parse(text.slice('/clarify '.length));
          } catch {
            throw new IntakeError(
              'CLARIFICATION_FORMAT',
              'The case clarification is not valid.',
              'Identify the accepted reference, issued policy and policy details by filename.',
            );
          }
          await caseService.clarify(context, clarification);
        }
        const naturalComparison = /^Compare the documents(?: as of (\d{4}-\d{2}-\d{2}))?\.?$/i.exec(normalized);
        if (text.startsWith('/compare ') || naturalComparison) {
          if (!comparison) throw new IntakeError('COMPARISON_UNAVAILABLE', 'Comparison is not configured.');
          let input: unknown;
          if (naturalComparison) {
            const record = await caseService.repository.requireCase(context);
            input = {
              caseId: record.id,
              expectedRevision: record.revision,
              profileId: defaultInsuranceProfile,
              asOf: naturalComparison[1] ?? new Date().toISOString().slice(0, 10),
              retryAttemptId: null,
            };
          } else {
            try {
              input = JSON.parse(text.slice('/compare '.length));
            } catch {
              throw new IntakeError('COMPARISON_FORMAT', 'The comparison request is not valid.');
            }
          }
          const result = await comparison.compare(context, input);
          if (result && typeof result === 'object' && 'report' in result) notice = reportNotice(result, context);
          else if (result && typeof result === 'object' && 'ok' in result && result.ok === false)
            notice = conversationFailure(
              new IntakeError(
                'COMPARISON_FAILED',
                'The comparison could not be completed. No new reviewable report was published.',
              ),
            );
          else notice = 'Comparison is saved. Say “Show the report” to check the reviewable draft.';
        }
        const naturalReport = /^Show the report\.?$/i.test(normalized);
        if (normalized === '/report' || text.startsWith('/report ') || naturalReport) {
          if (!report) throw new IntakeError('REPORT_UNAVAILABLE', 'Report retrieval is not configured.');
          const record = await caseService.repository.requireCase(context);
          let input: unknown = { caseId: record.id };
          if (text.startsWith('/report ')) {
            try {
              input = JSON.parse(text.slice('/report '.length));
            } catch {
              throw new IntakeError('REPORT_FORMAT', 'The report request is not valid.');
            }
          }
          notice = reportNotice(await report(context, input), context);
        }
        const naturalEvidence = /^Show page ([1-9]\d*) of "([^"\n]+)"\.?$/i.exec(normalized);
        if (text.startsWith('/evidence ') || naturalEvidence) {
          const legacy = /^\/evidence ([a-f0-9-]{36}) ([1-9]\d*)$/.exec(normalized);
          if (!naturalEvidence && !legacy)
            throw new IntakeError('EVIDENCE_LOCATOR', 'The source page request is invalid.');
          const source = naturalEvidence
            ? await sourcesByName(naturalEvidence[2]!)
            : (await caseService.repository.sources(context)).find(source => source.sourceId === legacy![1]);
          if (!source)
            throw new IntakeError(
              'SOURCE_NAME',
              'That document is not saved in this conversation.',
              'Show status to see the available filenames.',
            );
          const page = Number(naturalEvidence?.[1] ?? legacy![2]);
          const evidence = await caseService.evidence(context, source.sourceId, { physicalPage: page });
          notice =
            'text' in evidence
              ? `${markdown(source.displayName)}, physical page ${page}:\n\n${markdown(evidence.text)}`
              : 'This document does not have physical PDF pages.';
        }
        const status = await caseService.status(context);
        const resourceId = memoryContext?.resourceId ?? latest?.resourceId ?? operatorId;
        if (!(await memory.getThreadById({ threadId }))) await memory.createThread({ threadId, resourceId });
        if ('case' in status && status.case) {
          const record = status.case;
          const savedReport =
            'report' in status
              ? (status.report as {
                  report?: { id: string; version: number; workflowRunId: string };
                  available?: boolean;
                })
              : undefined;
          await memory.updateWorkingMemory({
            threadId,
            resourceId,
            workingMemory: JSON.stringify({
              activeCaseId: record.id,
              activePolicyNumber: record.identity.policyNumber,
              insuredName: record.identity.insuredName,
              insuranceProduct: record.identity.insuranceProduct,
              documentIds: record.sourceIds,
              workflowRunId: savedReport?.report?.workflowRunId ?? null,
              draftReportId: savedReport?.available ? (savedReport.report?.id ?? null) : null,
              draftVersion: savedReport?.available ? (savedReport.report?.version ?? null) : null,
              reviewStatus: record.latestReportId ? record.state : null,
            }),
          });
        }
        const handled = Boolean(
          files.length ||
          notice ||
          namedClarification ||
          /^\/(case|clarify|status|new)(?:\s|$)/.test(text) ||
          /^Show status\.?$/i.test(normalized),
        );
        if (reviewCommand || handled || !allowControlledModel) {
          state.localResponse = notice ?? statusNotice(status);
        }
        return sanitized;
      } catch (error) {
        state.localResponse = conversationFailure(error);
        return sanitized;
      }
    },
    processInputStep({ state }) {
      if (typeof state.localResponse === 'string')
        return { model: createLocalResponseModel(state.localResponse), tools: {}, toolChoice: 'none' };
    },
  };
}
