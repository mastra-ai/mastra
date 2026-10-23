import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { failureSchema, safeFailure, type Failure } from '../src/mastra/domain/errors.js';
import { reportHash } from '../src/mastra/domain/reports.js';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { reportRuntime, reportContext } from '../tests/report-runtime.js';
import { fixtureFiles } from '../tests/reconciliation-fixtures.js';
import type { EvaluationCase } from '../tests/evaluation-cases.js';
import type { ProcessingBudget } from '../src/mastra/domain/reconciliation-contracts.js';
import type { EvaluationObservation } from './evaluation.js';

export async function runEvaluationCase(
  test: EvaluationCase,
  root: string,
  endpoint?: string,
  budget?: ProcessingBudget,
) {
  await mkdir(root, { recursive: true, mode: 0o700 });
  const runtime = await reportRuntime(root, endpoint, undefined, undefined, undefined, undefined, budget);
  const actual: EvaluationObservation = {
    state: 'unknown',
    caseState: null,
    failure: null,
    comparisons: [],
    extractions: [],
    sources: [],
    reportChecks: [],
    pendingBeforeReview: false,
    explicitApprovalFinalized: false,
    unauthorizedFinal: false,
  };
  async function observeSavedState(failure?: Failure) {
    const status = await runtime.reconciliationRepository.status(reportContext);
    const attempt = status.attempts.at(-1);
    actual.caseState = (await runtime.cases.active(reportContext))?.state ?? null;
    actual.failure = attempt?.failure ?? failure ?? actual.failure;
    actual.extractions = attempt ? await runtime.reconciliationRepository.extractions(reportContext, attempt.id) : [];
    return status;
  }
  try {
    const captured = await runtime.caseService.capture(reportContext, await fixtureFiles(test.documents));
    const sources = await runtime.cases.sources(reportContext);
    actual.sources = sources;
    const property = test.documents[0]!.line === 'property';
    const clarified = await runtime.caseService.clarify(reportContext, {
      caseId: captured.id,
      expectedRevision: captured.revision,
      identity: {
        policyNumber: property ? 'CP-4021' : null,
        insuredName: property ? 'Elm Harbor Fabrication LLC' : 'Lark Systems Advisory LLC',
        insuranceProduct: property ? 'Commercial property' : 'Professional liability',
      },
      intent: property ? 'agreed_terms_checking' : 'document_comparison',
      referenceId: sources[0]!.sourceId,
      targetId: sources[1]!.sourceId,
      roles: sources.map((s, i) => ({
        sourceId: s.sourceId,
        role: i === 0 ? 'proposal' : i === 1 ? (property ? 'issued_policy' : 'contract') : test.documents[i]!.kind,
      })),
      acceptedBaseline: property
        ? { sourceId: sources[0]!.sourceId, statement: 'The broker records acceptance of this captured proposal.' }
        : null,
    });
    const compared = await runtime.comparison.runner.compare(reportContext, {
      caseId: captured.id,
      expectedRevision: clarified.revision,
      profileId: 'generic',
      asOf: '2026-05-01',
      retryAttemptId: null,
    });
    const failure = failureSchema.safeParse(compared);
    const status = await observeSavedState(failure.success ? failure.data : undefined);
    const analysis = status.analyses.at(-1);
    if (!analysis) {
      actual.state = 'failed';
      return actual;
    }
    actual.comparisons = analysis.comparisons;
    const report = await runtime.reports.current(reportContext, { caseId: captured.id });
    const publication = (await runtime.reportRepository.get(reportContext))!;
    const draftBytes = await runtime.reportRepository.bytes(publication);
    const draftText = await pdfText(draftBytes, true);
    actual.reportChecks.push(
      { obligation: 'draft_available', passed: report.available && draftBytes.length > 0 },
      { obligation: 'snapshot_binding', passed: report.snapshotHash === reportHash(report.report) },
      {
        obligation: 'source_manifest',
        passed: sources.every(s =>
          report.report.sources.some(
            saved => saved.sourceId === s.sourceId && saved.hash === s.hash && saved.version === s.version,
          ),
        ),
      },
      {
        obligation: 'limitations_preserved',
        passed: analysis.limitations.every(l => report.report.limitations.includes(l)),
      },
      {
        obligation: 'rendered_sections',
        passed: [
          'A. Identification',
          'B. Executive summary',
          'C. Discrepancy summary',
          'D. Detailed findings',
          'E. Authorized changes',
          'F. Verified terms',
          'G. Missing evidence and limitations',
          'H. Sources',
          'I. Broker review',
        ].every(section => draftText.includes(section)),
      },
      {
        obligation: 'rendered_findings',
        passed:
          analysis.comparisons.length === report.report.comparisons.length &&
          analysis.comparisons.every(
            f =>
              draftText.includes(f.label) && f.evidence.every(e => normalize(draftText).includes(normalize(e.excerpt))),
          ),
      },
    );
    const record = await runtime.cases.requireCase(reportContext);
    actual.pendingBeforeReview =
      record.state === 'AWAITING_REVIEW' && !(await runtime.reviewRepository.approval(reportContext, report.report.id));
    actual.unauthorizedFinal = record.state === 'FINALIZED';
    const request = {
      operationId: randomUUID(),
      caseId: record.id,
      reportId: report.report.id,
      version: report.report.version,
      snapshotHash: report.snapshotHash,
      expectedRevision: record.revision,
      expectedState: 'AWAITING_REVIEW',
      action: 'approve',
      dispositions: [],
    };
    await runtime.comparison.review(reportContext, request, {
      messageId: randomUUID(),
      text: '/review ' + JSON.stringify(request),
    });
    actual.caseState = (await runtime.cases.requireCase(reportContext)).state;
    actual.explicitApprovalFinalized = actual.caseState === 'FINALIZED';
    const finalization = await runtime.finalizations.get(reportContext, report.report.id);
    const approval = await runtime.reviewRepository.approval(reportContext, report.report.id);
    const finalArtifact = finalization?.artifacts.find(a => a.stage === 'reportOutput');
    const finalDownload = finalArtifact
      ? await runtime.finalizations.download(reportContext, record.id, finalArtifact.id)
      : null;
    const finalText = finalDownload ? await pdfText(finalDownload.bytes) : '';
    actual.reportChecks.push(
      {
        obligation: 'final_available',
        passed:
          finalization?.state === 'PUBLISHED' &&
          finalText.includes('POLICY CHECKING REPORT') &&
          !finalText.includes('Draft — pending broker review'),
      },
      {
        obligation: 'approval_binding',
        passed:
          approval?.snapshotHash === publication.hash &&
          approval.version === publication.snapshot.version &&
          approval.snapshotId === publication.snapshot.id,
      },
    );
    actual.state = 'completed';
    return actual;
  } catch (error) {
    await observeSavedState(safeFailure(error));
    actual.state = 'failed';
    const failedCase = await runtime.cases.active(reportContext);
    const savedApproval = failedCase?.latestReportId
      ? await runtime.reviewRepository.approval(reportContext, failedCase.latestReportId)
      : null;
    actual.unauthorizedFinal ||= failedCase?.state === 'FINALIZED' && !savedApproval;
    return actual;
  } finally {
    await runtime.close();
  }
}

const normalize = (text: string) => text.replace(/\s+/g, ' ').trim();
async function pdfText(bytes: Uint8Array, body = false) {
  const task = getDocument({ data: new Uint8Array(bytes), useSystemFonts: false });
  const document = await task.promise;
  const pages: string[] = [];
  for (let i = 1; i <= document.numPages; i++) {
    const content = await (await document.getPage(i)).getTextContent();
    pages.push(
      content.items
        .filter(
          item =>
            'str' in item &&
            (!body || (item.transform[5] < 710 && item.transform[5] > 75 && !item.str.includes('(continued)'))),
        )
        .map(item => ('str' in item ? item.str : ''))
        .join(' '),
    );
  }
  await task.destroy();
  return pages.join(' ');
}
