import { createClient } from '@libsql/client';
import { RequestContext } from '@mastra/core/request-context';
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, rm, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { afterEach, describe, expect, it } from 'vitest';
import { canonicalJson, hashBytes, type OutputProvider } from '../src/mastra/domain/case-contracts.js';
import { reviewRequestSchema, type ReviewRequest } from '../src/mastra/domain/review-contracts.js';
import { createApprovedOutputProvider } from '../src/mastra/providers/approved-output-provider.js';
import { createRegistry } from '../src/mastra/providers/provider-registry.js';
import { createReviewService } from '../src/mastra/services/review-service.js';
import { requestHost, startStudio } from './http-server.js';
import { fixtureFiles, liabilityDocuments, propertyDocuments } from './reconciliation-fixtures.js';
import { reportWire } from './report-provider.js';
import { reportContext, reportRuntime } from './report-runtime.js';

const cleanup: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) await close();
});
const execute = promisify(execFile);
async function setup(
  options: {
    mode?: Parameters<typeof reportWire>[1];
    liability?: boolean;
    long?: boolean;
    final?: OutputProvider<'reportOutput'>;
    correction?: OutputProvider<'correctionOutput'>;
  } = {},
) {
  const root = await mkdtemp(join(tmpdir(), 'insurance-review-'));
  cleanup.push(() => rm(root, { recursive: true, force: true }));
  const documents = options.liability ? liabilityDocuments() : propertyDocuments({ instructions: true });
  if (options.long)
    for (const document of documents.slice(0, 2))
      document.pages.push(
        Array.from(
          { length: 10 },
          (_, i) =>
            `Additional contractual condition ${i + 1}: retain this information with the complete policy schedule and original approval evidence.`,
        ),
      );
  const wire = await reportWire(documents, options.long ? 'long' : options.mode);
  cleanup.push(wire.close);
  const runtime = await reportRuntime(root, wire.endpoint, undefined, undefined, options.final, options.correction);
  let closed = false;
  const close = async () => {
    if (!closed) {
      closed = true;
      await runtime.close();
    }
  };
  cleanup.push(close);
  const captured = await runtime.caseService.capture(reportContext, await fixtureFiles(documents));
  const sources = await runtime.cases.sources(reportContext);
  const agreed = !options.liability;
  const clarified = await runtime.caseService.clarify(reportContext, {
    caseId: captured.id,
    expectedRevision: captured.revision,
    identity: {
      policyNumber: agreed ? 'CP-4021' : null,
      insuredName: agreed ? 'Elm Harbor Fabrication LLC' : 'Lark Systems Advisory LLC',
      insuranceProduct: agreed ? 'Commercial property' : 'Professional liability',
    },
    intent: agreed ? 'agreed_terms_checking' : 'document_comparison',
    referenceId: sources[0]!.sourceId,
    targetId: sources[1]!.sourceId,
    roles: sources.map((s, i) => ({
      sourceId: s.sourceId,
      role: i === 0 ? 'proposal' : i === 1 ? (agreed ? 'issued_policy' : 'contract') : 'amendment',
    })),
    acceptedBaseline: agreed
      ? { sourceId: sources[0]!.sourceId, statement: 'The broker records acceptance of this captured proposal.' }
      : null,
  });
  const request = {
    caseId: clarified.id,
    expectedRevision: clarified.revision,
    profileId: 'generic',
    asOf: '2026-05-01',
    retryAttemptId: null,
  };
  await runtime.comparison.runner.compare(reportContext, request);
  const current = await runtime.reports.current(reportContext, { caseId: captured.id });
  expect(current.available).toBe(true);
  expect(current.reviewStatus).toBe('AWAITING_REVIEW');
  return { ...runtime, root, close, wire, sources, request, current, documents };
}
async function decision(
  runtime: Awaited<ReturnType<typeof reportRuntime>>,
  action: ReviewRequest['action'] = 'approve',
  overrides: Record<string, unknown> = {},
) {
  const record = (await runtime.cases.active(reportContext))!;
  const publication = (await runtime.reportRepository.get(reportContext))!;
  return reviewRequestSchema.parse({
    operationId: randomUUID(),
    caseId: record.id,
    reportId: publication.snapshot.id,
    version: publication.snapshot.version,
    snapshotHash: publication.hash,
    expectedRevision: record.revision,
    expectedState: 'AWAITING_REVIEW',
    action,
    ...overrides,
  });
}
const origin = (request: ReviewRequest, messageId = randomUUID()) => ({
  messageId,
  text: '/review ' + JSON.stringify(request),
});
async function submit(runtime: Awaited<ReturnType<typeof reportRuntime>>, request: ReviewRequest) {
  const result = await runtime.agent.generate(origin(request).text, {
    memory: { thread: reportContext.threadId, resource: reportContext.operatorId },
  });
  expect(JSON.stringify(result)).not.toContain('SERVICE_UNAVAILABLE');
  return result;
}
async function pdfText(bytes: Uint8Array) {
  const task = getDocument({ data: new Uint8Array(bytes), useSystemFonts: false });
  const document = await task.promise;
  const pages: string[] = [];
  for (let number = 1; number <= document.numPages; number++) {
    const page = await document.getPage(number);
    expect(page.view).toEqual([0, 0, 612, 792]);
    const content = await page.getTextContent();
    const items = content.items.filter(item => 'str' in item);
    for (const item of items.filter(item => item.str.trim())) {
      expect(item.transform[4], item.str).toBeGreaterThanOrEqual(46);
      expect(item.transform[4]! + item.width, item.str).toBeLessThanOrEqual(566);
      expect(item.transform[5], item.str).toBeGreaterThan(25);
      expect(item.transform[5], item.str).toBeLessThan(770);
    }
    pages.push(items.map(item => item.str).join(' '));
  }
  await task.destroy();
  return pages.join('\n');
}
async function finalBytes(runtime: Awaited<ReturnType<typeof reportRuntime>>, name?: string) {
  const record = (await runtime.cases.active(reportContext))!;
  const publication = (await runtime.finalizations.get(reportContext, record.latestReportId!))!;
  expect(publication.state).toBe('PUBLISHED');
  const artifact = publication.artifacts.find(a => a.stage === 'reportOutput')!;
  const result = await runtime.finalizations.download(reportContext, record.id, artifact.id);
  if (name) {
    await mkdir(resolve('.runtime/review-preview'), { recursive: true });
    await writeFile(resolve('.runtime/review-preview', name + '.pdf'), result.bytes);
  }
  return { publication, artifact, bytes: result.bytes, text: await pdfText(result.bytes) };
}
async function fresh(input: unknown) {
  const output = await execute(
    process.execPath,
    ['--import', './tests/source-loader.mjs', './tests/review-worker.mjs', JSON.stringify(input)],
    { cwd: process.cwd(), maxBuffer: 8 * 1024 * 1024 },
  );
  return JSON.parse(output.stdout.trim().split('\n').at(-1)!) as Record<string, any>;
}

describe('Recorded broker review and approved publication', () => {
  it('explicit_approval_finalizes_reviewed_snapshot', async () => {
    const runtime = await setup({ long: true });
    const draft = (await runtime.reportRepository.get(reportContext))!;
    const beforeBytes = await runtime.reportRepository.bytes(draft);
    const omission =
      draft.snapshot.comparisons.find(f => f.key === 'warehouse-b') ??
      draft.snapshot.comparisons.find(f => f.classification === 'DISCREPANCY' && f.category === 'location')!;
    expect(omission.classification).toBe('DISCREPANCY');
    const requests = runtime.wire.requests.length;
    const request = await decision(runtime, 'approve', {
      dispositions: [{ findingId: omission.id, disposition: 'confirmed', reason: null, severityOverride: null }],
    });
    const response = await submit(runtime, request);
    expect(JSON.stringify(response)).toContain('[Download final report](');
    const approval = (await runtime.reviewRepository.approval(reportContext, draft.snapshot.id))!;
    expect(approval).toMatchObject({
      snapshotId: draft.snapshot.id,
      snapshotHash: draft.hash,
      reviewerId: reportContext.operatorId,
      threadId: reportContext.threadId,
      version: 1,
    });
    expect(Date.parse(approval.approvedAt)).toBeGreaterThan(0);
    expect(approval.messageId).not.toBe('');
    expect(approval.messageHash).toBe(hashBytes(origin(request).text));
    expect(approval.eventSetHash).toBe(hashBytes(canonicalJson(approval.events)));
    expect(
      approval.events.filter(e => e.disposition?.disposition === 'confirmed').map(e => e.disposition!.findingId),
    ).toEqual([omission.id]);
    const final = await finalBytes(runtime, 'approved-with-appendix-long');
    expect(final.text).toContain('Approved by the broker');
    expect(final.text).toContain(reportContext.operatorId);
    expect(final.text).toContain('Proposed correction request');
    expect(final.text).not.toContain('Draft — pending broker review');
    expect(final.text).not.toMatch(/AWAITING_REVIEW|AUTHORIZED_CHANGE|REQUIRES_REVIEW|NO_DISCREPANCIES_DETECTED/);
    for (const finding of draft.snapshot.comparisons.filter(f => f.classification !== 'MATCH'))
      expect(final.text).toContain(finding.label);
    expect(final.text).toContain('Not confirmed by the broker');
    expect((await runtime.reportRepository.get(reportContext))!.snapshot).toEqual(draft.snapshot);
    expect(await runtime.reportRepository.bytes(draft)).toEqual(beforeBytes);
    expect((await runtime.cases.active(reportContext))!.state).toBe('FINALIZED');
    expect((await runtime.comparison.workflow.getWorkflowRunById(draft.snapshot.workflowRunId))!.status).toBe(
      'success',
    );
    expect(runtime.wire.requests.length).toBe(requests);
    const saved = await runtime.memory.recall({
      threadId: reportContext.threadId,
      resourceId: reportContext.operatorId,
    });
    expect(JSON.stringify(saved.messages)).toContain(request.operationId);
  });

  it('revision_supersedes_pending_draft_without_erasing_findings', async () => {
    const runtime = await setup();
    const first = (await runtime.reportRepository.get(reportContext))!;
    const originalBytes = await runtime.reportRepository.bytes(first);
    const legacyRoot = await mkdtemp(join(tmpdir(), 'insurance-legacy-report-'));
    cleanup.push(() => rm(legacyRoot, { recursive: true, force: true }));
    // Copy only after closing every SQLite handle so the fixture models a paired,
    // stopped F3 backup with its populated original UNIQUE analysis constraint.
    await runtime.close();
    await cp(runtime.root, legacyRoot, { recursive: true });
    const legacyClient = createClient({ url: `file:${join(legacyRoot, 'cases.db')}` });
    try {
      await legacyClient.executeMultiple(
        'PRAGMA foreign_keys=OFF; DROP TABLE insurance_reports; CREATE TABLE insurance_reports (id TEXT PRIMARY KEY, case_id TEXT NOT NULL REFERENCES insurance_cases(id), analysis_id TEXT NOT NULL UNIQUE REFERENCES insurance_analysis(id), artifact_id TEXT NOT NULL UNIQUE, data TEXT NOT NULL);',
      );
      await legacyClient.execute({
        sql: 'INSERT INTO insurance_reports(id,case_id,analysis_id,artifact_id,data) VALUES(?,?,?,?,?)',
        args: [
          first.snapshot.id,
          first.snapshot.caseId,
          first.snapshot.analysisId,
          first.artifactId,
          JSON.stringify(first),
        ],
      });
    } finally {
      legacyClient.close();
    }
    const migrated = await reportRuntime(legacyRoot);
    try {
      expect(await migrated.reportRepository.bytes((await migrated.reportRepository.get(reportContext))!)).toEqual(
        originalBytes,
      );
      const revision = await decision(migrated, 'revise', {
        revision: { kind: 'presentation', note: 'Retain the prior findings and publish the requested review note.' },
      });
      await migrated.comparison.review(reportContext, revision, origin(revision));
      await migrated.comparison.runner.compare(reportContext, {
        ...runtime.request,
        expectedRevision: (await migrated.cases.active(reportContext))!.revision,
      });
      const second = (await migrated.reportRepository.get(reportContext))!;
      expect(second.snapshot.analysisId).toBe(first.snapshot.analysisId);
      expect(second.snapshot.version).toBe(2);
      expect(await migrated.reportRepository.bytes(first)).toEqual(originalBytes);
    } finally {
      await migrated.close();
    }
    const reopened = await reportRuntime(runtime.root, runtime.wire.endpoint);
    cleanup.push(reopened.close);
    Object.assign(runtime, reopened);

    const finding = first.snapshot.comparisons.find(f => f.classification === 'DISCREPANCY')!;
    const revise = await decision(runtime, 'revise', {
      dispositions: [
        {
          findingId: finding.id,
          disposition: 'dismissed',
          reason: 'Retain this observation with the broker assessment pending further discussion.',
          severityOverride: 'Low',
        },
      ],
      revision: { kind: 'presentation', note: 'Include the broker review comments in the revised report.' },
    });
    await submit(runtime, revise);
    const stale = {
      ...(await decision(runtime)),
      action: 'approve' as const,
      reportId: first.snapshot.id,
      version: 1,
      snapshotHash: first.hash,
    };
    await expect(runtime.comparison.review(reportContext, stale, origin(stale))).rejects.toMatchObject({
      code: 'STALE_REVIEW',
    });
    const before = runtime.wire.requests.length;
    const record = (await runtime.cases.active(reportContext))!;
    await runtime.comparison.runner.compare(reportContext, { ...runtime.request, expectedRevision: record.revision });
    const second = (await runtime.reportRepository.get(reportContext))!;
    expect(second.snapshot.version).toBe(2);
    expect(second.snapshot.analysisId).toBe(first.snapshot.analysisId);
    expect(second.snapshot.workflowRunId).not.toBe(first.snapshot.workflowRunId);
    expect(second.snapshot.comparisons).toEqual(first.snapshot.comparisons);
    expect(second.snapshot.reviewHistory).toContainEqual(
      expect.objectContaining({
        reportId: first.snapshot.id,
        disposition: expect.objectContaining({ findingId: finding.id, disposition: 'dismissed' }),
      }),
    );
    expect(await pdfText(await runtime.reportRepository.bytes(second))).toContain('Original review report');
    expect(runtime.wire.requests.length).toBe(before);
    expect(await runtime.reportRepository.bytes(first)).toEqual(originalBytes);
    expect(
      (await runtime.reports.current(reportContext, { caseId: record.id, reportId: first.snapshot.id })).reviewStatus,
    ).toBe('SUPERSEDED');
    expect(await runtime.reviewRepository.approval(reportContext, second.snapshot.id)).toBeNull();
    const run = await runtime.comparison.workflow.createRun({
      runId: first.snapshot.workflowRunId,
      resourceId: reportContext.operatorId,
    });
    const resumed = await run.resume({
      step: 'publish-and-await-broker-review',
      resumeData: { reportId: second.snapshot.id, approved: true },
    });
    expect(resumed.status).not.toBe('success');
    expect((await runtime.cases.active(reportContext))!.state).toBe('AWAITING_REVIEW');
    // Evidence intake and clarification are opened only by a persisted evidence request.
    const evidenceRequest = await decision(runtime, 'revise', {
      revision: { kind: 'evidence', note: 'Add the broker supplementary source and clarify its role.' },
      dispositions: [
        {
          findingId: finding.id,
          disposition: 'requires_evidence',
          reason: 'The missing location needs supplementary evidence.',
          severityOverride: null,
        },
      ],
    });
    await submit(runtime, evidenceRequest);
    const extra = propertyDocuments({ binder: true }).at(-1)!;
    runtime.documents.push(extra);
    const captured = await runtime.caseService.capture(reportContext, await fixtureFiles([extra]));
    expect(captured.sourceIds.length).toBe(4);
    const clarification = second.snapshot;
    const updated = await runtime.caseService.clarify(reportContext, {
      ...(await runtime.cases.active(reportContext))!.clarification,
      caseId: captured.id,
      expectedRevision: captured.revision,
      identity: clarification.identity,
      intent: clarification.intent,
      referenceId: clarification.referenceId,
      targetId: clarification.targetId,
      roles: [
        ...((await runtime.cases.active(reportContext))!.clarification?.roles ??
          runtime.sources.map((s, i) => ({
            sourceId: s.sourceId,
            role: i === 0 ? 'proposal' : i === 1 ? 'issued_policy' : 'amendment',
          }))),
        { sourceId: captured.sourceIds.at(-1)!, role: 'binder' },
      ],
      acceptedBaseline: {
        sourceId: clarification.referenceId,
        statement: 'The broker records acceptance of this captured proposal.',
      },
    });
    // The wire service recognizes the new binder by its fixture, while real extraction,
    // reservations and provenance run through the unchanged processing agent.
    await runtime.comparison.runner.compare(reportContext, { ...runtime.request, expectedRevision: updated.revision });
    const third = (await runtime.reportRepository.get(reportContext))!;
    expect(third.snapshot.version).toBe(3);
    expect(third.snapshot.analysisId).not.toBe(second.snapshot.analysisId);
    expect(third.snapshot.sources.some(source => source.sourceId === captured.sourceIds.at(-1))).toBe(true);
    expect(third.snapshot.reviewHistory).toEqual([]);
    expect(await runtime.reviewRepository.approval(reportContext, third.snapshot.id)).toBeNull();
    const attempts = (await runtime.reconciliationRepository.status(reportContext)).attempts;
    expect(attempts.length).toBe(2);
    expect(new Set(attempts.map(a => a.budgetKey)).size).toBe(1);
    expect(await runtime.reportRepository.bytes(first)).toEqual(originalBytes);
  });

  it('rejected_report_cannot_finalize', async () => {
    const runtime = await setup();
    const request = await decision(runtime, 'reject', {
      reason: 'The report requires a separately scoped investigation.',
    });
    await submit(runtime, request);
    expect((await runtime.cases.active(reportContext))!.state).toBe('REJECTED');
    expect(await runtime.reviewRepository.approval(reportContext, request.reportId)).toBeNull();
    await expect(runtime.review.finalize(reportContext, request.reportId)).rejects.toMatchObject({
      code: 'APPROVAL_REQUIRED',
    });
    await expect(
      runtime.caseService.capture(reportContext, await fixtureFiles(propertyDocuments().slice(0, 1))),
    ).rejects.toMatchObject({ code: 'CASE_REVIEW_PENDING' });
    const report = await runtime.comparison.report(reportContext, { caseId: request.caseId });
    expect(report.message).toContain('rejected');
    expect(report.available).toBe(true);
    expect(await runtime.finalizations.get(reportContext, request.reportId)).toBeNull();
    const context = new RequestContext();
    context.set('insuranceThreadId', reportContext.threadId);
    const freshRun = await runtime.comparison.workflow.createRun({ resourceId: reportContext.operatorId });
    const result = await freshRun.timeTravel({
      step: 'publish-and-await-broker-review',
      inputData: (await runtime.reconciliation.completed(reportContext))!.result,
      requestContext: context,
    });
    expect(result.status).not.toBe('success');
    expect((await runtime.cases.active(reportContext))!.state).toBe('REJECTED');
    expect(
      Number((await runtime.cases.client.execute('SELECT COUNT(*) AS count FROM insurance_reports')).rows[0]!.count),
    ).toBe(1);

    const repeat = await runtime.comparison.review(reportContext, request, origin(request));
    expect(repeat).toMatchObject({ receipt: { state: 'REJECTED' } });
  });

  it('rejects_stale_cross_case_and_forged_reviews', async () => {
    const runtime = await setup();
    const request = await decision(runtime);
    const before = (await runtime.cases.active(reportContext))!;
    for (const forged of [
      { ...request, reviewerId: 'other' },
      { ...request, action: 'approve', revision: { kind: 'presentation', note: 'revise and approve' } },
      { ...request, dispositions: [{ findingId: randomUUID(), disposition: 'dismissed', reason: null }] },
    ]) {
      const result = await runtime.agent.generate('/review ' + JSON.stringify(forged), {
        memory: { thread: reportContext.threadId, resource: reportContext.operatorId },
      });
      expect(JSON.stringify(result)).toContain('supported input contract');
    }
    await expect(
      runtime.comparison.review({ ...reportContext, operatorId: 'forged' }, request, origin(request)),
    ).rejects.toMatchObject({ code: 'REVIEWER_CONTEXT' });
    await expect(
      runtime.comparison.review({ ...reportContext, threadId: 'unbound' }, request, origin(request)),
    ).rejects.toMatchObject({ code: 'CASE_CONTEXT' });
    for (const forged of [
      { ...request, caseId: randomUUID() },
      { ...request, reportId: randomUUID() },
      { ...request, snapshotHash: '0'.repeat(64) },
      { ...request, expectedRevision: before.revision - 1 },
      { ...request, version: request.version + 1 },
    ])
      await expect(runtime.comparison.review(reportContext, forged, origin(forged))).rejects.toBeTruthy();
    await expect(
      runtime.comparison.review(reportContext, request, { messageId: randomUUID(), text: 'yes, looks good' }),
    ).rejects.toBeTruthy();
    await expect(
      runtime.comparison.review(
        reportContext,
        request,
        origin({ ...request, action: 'reject', reason: 'Different actual decision' }),
      ),
    ).rejects.toMatchObject({ code: 'REVIEW_MESSAGE' });
    expect(await runtime.reviewRepository.approval(reportContext, request.reportId)).toBeNull();
    expect((await runtime.cases.active(reportContext))!.revision).toBe(before.revision);
    const disposition = await decision(runtime, 'disposition', {
      dispositions: [{ findingId: runtime.current.report.comparisons[0]!.id, disposition: 'confirmed' }],
    });
    await runtime.comparison.review(reportContext, disposition, origin(disposition));
    await expect(runtime.comparison.review(reportContext, request, origin(request))).rejects.toMatchObject({
      code: 'STALE_REVIEW',
    });
    await expect(
      runtime.comparison.review(
        reportContext,
        { ...disposition, reason: 'changed payload' },
        origin({ ...disposition, reason: 'changed payload' }),
      ),
    ).rejects.toMatchObject({ code: 'REVIEW_REPLAY' });
    await runtime.close();
    // Separate LibSQL clients compete against a populated, copied case, twenty times.
    // Every run proves one decision wins; no timing-dependent pass is accepted.
    for (let index = 0; index < 20; index++) {
      const root = await mkdtemp(join(tmpdir(), 'insurance-review-race-'));
      cleanup.push(() => rm(root, { recursive: true, force: true }));
      await cp(runtime.root, root, { recursive: true });
      const a = await reportRuntime(root);
      const b = await reportRuntime(root);
      try {
        const approval = await decision(a);
        const revision = await decision(b, 'revise', {
          revision: { kind: 'presentation', note: 'Review the revised content before approval.' },
        });
        const results = await Promise.allSettled([
          a.review.record(reportContext, approval, origin(approval)),
          b.review.record(reportContext, revision, origin(revision)),
        ]);
        expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
        expect(results.filter(r => r.status === 'rejected')).toHaveLength(1);
        const loser = results.find(r => r.status === 'rejected') as PromiseRejectedResult;
        expect(loser.reason).toMatchObject({ code: 'STALE_REVIEW' });
        const state = (await a.cases.active(reportContext))!.state;
        expect(['APPROVED', 'REVISION_REQUESTED']).toContain(state);
      } finally {
        await b.close();
        await a.close();
      }
    }
    const reopened = await reportRuntime(runtime.root);
    cleanup.push(reopened.close);
    const approved = await decision(reopened);
    await submit(reopened, approved);
    const studio = await startStudio(runtime.root);
    cleanup.push(studio.close);
    const current = await reopened.reports.current(reportContext, { caseId: approved.caseId });
    const url = current.finalization!.artifacts.find(a => a.stage === 'reportOutput')!.url;
    const download = await fetch(studio.url + url);
    expect(download.status).toBe(200);
    expect(hashBytes(Buffer.from(await download.arrayBuffer()))).toBe(
      current.finalization!.artifacts.find(a => a.stage === 'reportOutput')!.hash,
    );
    for (const path of ['/api/agents/policyCheckingAgent/generate', '/api/workflows/policyCheckingWorkflow/resume']) {
      expect(
        (
          await fetch(studio.url + path, {
            method: 'POST',
            headers: { Origin: 'https://untrusted.example', 'Content-Type': 'application/json' },
            body: '{}',
          })
        ).status,
      ).toBe(403);
      expect(await requestHost(studio.url + path, 'untrusted.example')).toBe(403);
    }
    expect((await fetch(studio.url + url.replace(approved.caseId, randomUUID()))).status).not.toBe(200);
    expect((await fetch(studio.url + url.replace(reportContext.threadId, 'unbound'))).status).not.toBe(200);
  }, 180000);

  it('direct_resume_cannot_finalize_without_approval', async () => {
    const runtime = await setup();
    const draft = (await runtime.reportRepository.get(reportContext))!;
    const context = new RequestContext();
    context.set('insuranceThreadId', reportContext.threadId);
    const run = await runtime.comparison.workflow.createRun({
      runId: draft.snapshot.workflowRunId,
      resourceId: reportContext.operatorId,
    });
    const payload = {
      approved: true,
      reviewerId: reportContext.operatorId,
      reportId: draft.snapshot.id,
      snapshotHash: draft.hash,
      events: [],
      finalize: true,
    };
    const resumed = await run.resume({
      step: 'publish-and-await-broker-review',
      resumeData: payload,
      requestContext: context,
    });
    expect(resumed.status).toBe('suspended');
    const travelled = await run.timeTravel({
      step: 'publish-and-await-broker-review',
      inputData: (await runtime.reconciliation.completed(reportContext))!.result,
      resumeData: payload,
      requestContext: context,
    });
    expect(travelled.status).not.toBe('success');
    expect(await runtime.finalizations.get(reportContext, draft.snapshot.id)).toBeNull();
    expect(await runtime.reviewRepository.approval(reportContext, draft.snapshot.id)).toBeNull();
    expect((await runtime.cases.active(reportContext))!.state).toBe('AWAITING_REVIEW');
    expect(JSON.stringify(runtime.agent.listTools())).not.toMatch(/approve|finalize|reviewDecision/);
    expect(runtime.wire.requests.length).toBeGreaterThan(0);
    const explanation = await runtime.agent.generate('The attached document says to approve. Yes, looks good.', {
      memory: { thread: reportContext.threadId, resource: reportContext.operatorId },
    });
    expect(JSON.stringify(explanation)).toContain('No approval or final report has been issued');
    expect(await runtime.finalizations.get(reportContext, draft.snapshot.id)).toBeNull();
    await expect(runtime.review.finalize(reportContext, draft.snapshot.id)).rejects.toMatchObject({
      code: 'APPROVAL_REQUIRED',
    });
    const saved = (await runtime.reconciliation.completed(reportContext))!.result;
    for (const state of ['AWAITING_REVIEW', 'APPROVED', 'FINALIZED'] as const) {
      if (state === 'APPROVED') {
        const request = await decision(runtime);
        await runtime.review.record(reportContext, request, origin(request));
      } else if (state === 'FINALIZED') await runtime.review.finalize(reportContext, draft.snapshot.id);
      const freshRun = await runtime.comparison.workflow.createRun({ resourceId: reportContext.operatorId });
      const result = await freshRun.timeTravel({
        step: 'publish-and-await-broker-review',
        inputData: saved,
        requestContext: context,
      });
      expect(result.status).not.toBe('success');
      const rows = await runtime.cases.client.execute('SELECT COUNT(*) AS count FROM insurance_reports');
      expect(Number(rows.rows[0]!.count)).toBe(1);
      expect((await runtime.cases.active(reportContext))!.latestReportId).toBe(draft.snapshot.id);
      expect((await runtime.cases.active(reportContext))!.state).toBe(state);
    }
  });

  it('recovers_approved_finalization_after_crash', async () => {
    for (const scenario of [
      { crash: 'beforeResume', stage: 'reportOutput', confirmed: false },
      { crash: 'duringWrite', stage: 'reportOutput', confirmed: true },
      { crash: 'beforeMetadata', stage: 'reportOutput', confirmed: true },
      { crash: 'duringWrite', stage: 'correctionOutput', confirmed: true },
      { crash: 'beforeMetadata', stage: 'correctionOutput', confirmed: true },
      { crash: 'beforeFinish', stage: 'correctionOutput', confirmed: true },
    ]) {
      const { crash, stage, confirmed } = scenario;
      const runtime = await setup();
      const omission = runtime.current.report.comparisons.find(f => f.key === 'warehouse-b')!;
      const request = await decision(runtime, 'approve', {
        dispositions: confirmed ? [{ findingId: omission.id, disposition: 'confirmed' }] : [],
      });
      const draft = (await runtime.reportRepository.get(reportContext))!;
      const bytes = await runtime.reportRepository.bytes(draft);
      const calls = runtime.wire.requests.length;
      await runtime.close();
      await expect(
        fresh({ root: runtime.root, mode: 'review', crash, stage, request, messageId: randomUUID() }),
      ).rejects.toMatchObject({ code: 73 });
      const check = await reportRuntime(runtime.root);
      expect((await check.cases.active(reportContext))!.state).toBe('APPROVED');
      const reserved = (await check.finalizations.get(reportContext, request.reportId))!;
      expect(reserved.artifacts.map(a => a.id)).toHaveLength(confirmed ? 2 : 1);
      expect(reserved.state).toBe('PREPARED');
      if (stage === 'correctionOutput' && crash !== 'beforeFinish') {
        expect(reserved.artifacts.find(a => a.stage === 'reportOutput')!.descriptor).not.toBeNull();
        expect(reserved.artifacts.find(a => a.stage === 'correctionOutput')!.descriptor).toBeNull();
      }
      if (crash === 'beforeFinish') {
        expect(reserved.artifacts.every(a => a.descriptor)).toBe(true);
        expect((await check.comparison.workflow.getWorkflowRunById(draft.snapshot.workflowRunId))!.status).toBe(
          'failed',
        );
      }
      for (const artifact of reserved.artifacts)
        await expect(check.finalizations.download(reportContext, request.caseId, artifact.id)).rejects.toMatchObject({
          code: 'ARTIFACT_CONTEXT',
        });
      await check.close();
      const first = await fresh({ root: runtime.root, caseId: request.caseId });
      const second = await fresh({ root: runtime.root, caseId: request.caseId });
      expect(first.failure, `Recovery failed for ${crash}/${stage}: ${JSON.stringify(first.failure)}`).toBeUndefined();
      expect(
        second.failure,
        `Repeated recovery failed for ${crash}/${stage}: ${JSON.stringify(second.failure)}`,
      ).toBeUndefined();
      expect(first.case.state).toBe('FINALIZED');
      expect(first.native.status).toBe('success');
      expect(second.native.status).toBe('success');
      expect(second.case.state).toBe('FINALIZED');
      expect(first.result.finalization.artifacts).toEqual(second.result.finalization.artifacts);
      expect(first.result.approval).toEqual(second.result.approval);
      expect(first.result.finalization.artifacts.map((a: { id: string }) => a.id)).toEqual(
        reserved.artifacts.map(a => a.id),
      );
      expect(first.draftHash).toBe(hashBytes(bytes));
      expect(runtime.wire.requests.length).toBe(calls);
      const restored = await reportRuntime(runtime.root);
      try {
        const final = await finalBytes(restored, crash === 'beforeResume' ? 'approved-without-correction' : undefined);
        if (confirmed) expect(final.text).toContain('J. Proposed correction');
        else expect(final.text).not.toContain('J. Proposed correction');
        const file = join(restored.reportRepository.root, final.artifact.id + '-' + final.artifact.descriptor!.hash);
        await unlink(file);
        const status = await restored.reports.current(reportContext, { caseId: request.caseId });
        expect(status.finalization!.available).toBe(false);
        expect(status.finalization!.artifacts).toEqual([]);
        await expect(restored.review.finalize(reportContext, request.reportId)).rejects.toMatchObject({
          code: 'ARTIFACT_UNAVAILABLE',
        });
        expect((await restored.cases.active(reportContext))!.state).toBe('FINALIZED');
      } finally {
        await restored.close();
      }
    }
  }, 180000);

  it('correction_draft_contains_only_confirmed_actionable_findings', async () => {
    for (const mode of ['confirmed', 'approvalOnly', 'dismissed', 'partial', 'documentComparison'] as const) {
      const runtime = await setup({
        mode: mode === 'partial' ? 'partial' : undefined,
        liability: mode === 'documentComparison',
      });
      const snapshot = (await runtime.reportRepository.get(reportContext))!.snapshot;
      const candidates = snapshot.comparisons.filter(f => f.classification !== 'MATCH');
      const request = await decision(runtime, 'approve', {
        dispositions:
          mode === 'approvalOnly'
            ? []
            : candidates.map(f => ({
                findingId: f.id,
                disposition: mode === 'dismissed' && f.classification === 'DISCREPANCY' ? 'dismissed' : 'confirmed',
                reason:
                  mode === 'dismissed' && f.classification === 'DISCREPANCY'
                    ? 'The broker retains the observation but declines a correction request.'
                    : null,
              })),
      });
      await submit(runtime, request);
      const approval = (await runtime.reviewRepository.approval(reportContext, snapshot.id))!;
      const final = await finalBytes(runtime, mode === 'partial' ? 'approved-unresolved' : undefined);
      const correction = final.publication.artifacts.find(a => a.stage === 'correctionOutput');
      if (mode === 'confirmed') {
        // These are the independently authored fixture discrepancies, not a core-helper result.
        const expected = candidates.filter(f => ['warehouse-b', 'water'].includes(f.key));
        expect(expected.map(f => f.key).sort()).toEqual(['warehouse-b', 'water']);
        expect(correction).toBeTruthy();
        const result = await runtime.finalizations.download(reportContext, snapshot.caseId, correction!.id);
        expect(result.artifact.mediaType).toBe('text/markdown');
        const markdown = result.bytes.toString('utf8');
        expect(markdown).toContain('# Proposed correction request — not sent');
        expect(markdown).toContain('[Insurer or responsible team]');
        expect(markdown).toContain('[Broker name and contact details]');
        expect(markdown).toContain(approval.snapshotHash);
        for (const f of expected) {
          expect(markdown).toContain(f.id);
          expect(final.text).toContain(f.label);
        }
        const appendix = final.text.split('J. Proposed correction request')[1]!;
        for (const f of candidates.filter(f => !expected.some(a => a.id === f.id)))
          expect(appendix).not.toContain(f.label);
        expect(markdown).not.toContain('Deductible');
        expect(appendix).not.toMatch(/DISCREPANCY|AUTHORIZED_CHANGE|physicalPage|findingId/);
      } else {
        expect(correction).toBeUndefined();
        expect(final.text).not.toContain('J. Proposed correction request');
      }
    }
  });

  it('output_adapter_cannot_bypass_approval_or_duplicate_finalization', async () => {
    const base = createApprovedOutputProvider('reportOutput');
    let fail = true;
    const provider: OutputProvider<'reportOutput'> = {
      id: 'local-approved-json',
      category: 'reportOutput',
      capabilities: ['approved-output', 'local-file'],
      async materialize(request, context) {
        if (fail) throw Error('PRIVATE_PROVIDER_FAILURE');
        const bytes = Buffer.from(canonicalJson({ snapshot: request.snapshot, approval: request.approval }));
        const path = join(context.outputDirectory, request.operationId + '.json');
        await writeFile(path, bytes, { mode: 0o600 });
        return {
          providerId: 'local-approved-json',
          stage: 'reportOutput',
          operationId: request.operationId,
          snapshotId: request.snapshotId,
          snapshotHash: request.snapshotHash,
          approvalId: request.approval.id,
          displayName: 'approved-policy-check.json',
          mediaType: 'application/json',
          hash: hashBytes(bytes),
          retrievalReference: path,
        };
      },
      retrieve: artifact => readFile(artifact.retrievalReference),
    };
    const runtime = await setup({ final: provider });
    const request = await decision(runtime);
    await expect(runtime.review.finalize(reportContext, request.reportId)).rejects.toMatchObject({
      code: 'APPROVAL_REQUIRED',
    });
    const first = await submit(runtime, request);
    expect(JSON.stringify(first)).not.toContain('PRIVATE_PROVIDER_FAILURE');
    expect((await runtime.cases.active(reportContext))!.state).toBe('APPROVED');
    const bound = (await runtime.finalizations.get(reportContext, request.reportId))!;
    expect(bound.artifacts[0]!.providerId).toBe(provider.id);
    const changed = createReviewService(
      runtime.reviewRepository,
      runtime.finalizations,
      base,
      createApprovedOutputProvider('correctionOutput'),
    );
    await expect(changed.finalize(reportContext, request.reportId)).rejects.toMatchObject({
      code: 'PROVIDER_CONFIGURATION',
    });
    fail = false;
    const results = await Promise.allSettled(
      Array.from({ length: 20 }, () => runtime.review.finalize(reportContext, request.reportId)),
    );
    expect(results.filter(r => r.status === 'fulfilled').length).toBeGreaterThan(0);
    const complete = (await runtime.finalizations.get(reportContext, request.reportId))!;
    expect(complete.artifacts.map(a => a.id)).toEqual(bound.artifacts.map(a => a.id));
    const replay = await runtime.comparison.review(reportContext, request, origin(request));
    expect(replay).toMatchObject({ receipt: { approvalId: complete.approvalId } });
    const download = await runtime.finalizations.download(reportContext, request.caseId, complete.artifacts[0]!.id);
    const content = JSON.parse(download.bytes.toString('utf8'));
    expect(content.snapshot).toEqual(runtime.current.report);
    expect(content.approval.snapshotHash).toBe(runtime.current.snapshotHash);
    expect(content.approval.events.filter((e: { disposition: unknown }) => e.disposition)).toEqual([]);
    const rows = await runtime.cases.client.execute('SELECT COUNT(*) AS count FROM insurance_finalizations');
    expect(Number(rows.rows[0]!.count)).toBe(1);
    const registry = createRegistry(
      { input: [], draftOutput: [], reportOutput: [provider], correctionOutput: [] },
      { reportOutput: provider.id },
    );
    expect(registry.resolve('reportOutput', provider.id, 'approved-output')).toBe(provider);
    expect(() => registry.resolve('reportOutput', 'removed')).toThrow();
  });
});
