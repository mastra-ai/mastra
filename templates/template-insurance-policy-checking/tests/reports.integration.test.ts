import { createClient } from '@libsql/client';
import { RequestContext } from '@mastra/core/request-context';
import { TABLE_WORKFLOW_SNAPSHOT } from '@mastra/core/storage';
import { noopObserve } from '@mastra/core/tools';
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { access, mkdir, mkdtemp, readFile, rename, rm, symlink, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { promisify } from 'node:util';
import { PDFDocument } from 'pdf-lib';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { afterEach, describe, expect, it } from 'vitest';
import { hashBytes, type InputProvider, type OutputProvider } from '../src/mastra/domain/case-contracts.js';
import {
  correctionOutputRequestSchema,
  draftOutputRequestSchema,
  reportOutputRequestSchema,
} from '../src/mastra/domain/output-contracts.js';
import { reportCounts, reportHash, reportSnapshotSchema, reportStatus } from '../src/mastra/domain/report-contracts.js';
import { createDraftPdfProvider, renderDraftPdf } from '../src/mastra/providers/draft-pdf-provider.js';
import { createRegistry } from '../src/mastra/providers/provider-registry.js';
import { createReportService } from '../src/mastra/services/report-service.js';
import { createReportTool } from '../src/mastra/tools/report-tool.js';
import { requestHost, startStudio } from './http-server.js';
import { fixtureFiles, liabilityDocuments, propertyDocuments } from './reconciliation-fixtures.js';
import { reportRecordInput, reportWire } from './report-provider.js';
import { conversationReply, reportContext, reportRuntime } from './report-runtime.js';

const cleanup: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) await close();
});
const execute = promisify(execFile);
async function setup(
  documents = propertyDocuments(),
  mode: Parameters<typeof reportWire>[1] = 'normal',
  provider?: OutputProvider<'draftOutput'>,
  input?: InputProvider,
) {
  const root = await mkdtemp(join(tmpdir(), 'insurance-reports-'));
  cleanup.push(() => rm(root, { recursive: true, force: true }));
  const wire = await reportWire(documents, mode);
  cleanup.push(wire.close);
  const runtime = await reportRuntime(root, wire.endpoint, provider, input);
  let closed = false;
  cleanup.push(async () => {
    if (!closed) {
      closed = true;
      await runtime.close();
    }
  });
  const captured = await runtime.caseService.capture(reportContext, input ? {} : await fixtureFiles(documents));
  const sources = await runtime.cases.sources(reportContext);
  const agreed = !input && documents[0]!.line === 'property';
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
      ? { sourceId: sources[0]!.sourceId, statement: 'The broker records acceptance of the captured proposal.' }
      : null,
  });
  const request = {
    caseId: clarified.id,
    expectedRevision: clarified.revision,
    profileId: 'generic',
    asOf: '2026-05-01',
    retryAttemptId: null,
  };
  return {
    ...runtime,
    root,
    wire,
    request,
    sources,
    async close() {
      if (!closed) {
        closed = true;
        await runtime.close();
      }
    },
    async compare() {
      await runtime.comparison.runner.compare(reportContext, request);
      return runtime.reports.current(reportContext, { caseId: request.caseId });
    },
  };
}
async function savedPdf(runtime: Awaited<ReturnType<typeof setup>>, name: string) {
  const publication = (await runtime.reportRepository.get(reportContext))!;
  const bytes = await runtime.reportRepository.bytes(publication);
  await mkdir(resolve('.runtime/report-preview'), { recursive: true });
  await writeFile(resolve('.runtime/report-preview', name + '.pdf'), bytes);
  return { publication, bytes };
}
async function inspectPdf(bytes: Uint8Array) {
  const task = getDocument({ data: new Uint8Array(bytes), useSystemFonts: false });
  const doc = await task.promise;
  const pages: { text: string; body: string; items: { str: string; x: number; y: number; width: number }[] }[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    expect(page.view).toEqual([0, 0, 612, 792]);
    const content = await page.getTextContent();
    const items = content.items
      .filter(item => 'str' in item)
      .map(item => ({
        str: item.str,
        x: item.transform[4] as number,
        y: item.transform[5] as number,
        width: item.width,
      }));
    for (const item of items.filter(item => item.str.trim())) {
      expect(item.x, `Left boundary: ${item.str}`).toBeGreaterThanOrEqual(46);
      expect(item.x + item.width, `Right boundary: ${item.str}`).toBeLessThanOrEqual(566);
      expect(item.y).toBeGreaterThan(25);
      expect(item.y).toBeLessThan(770);
    }
    const text = items.map(item => item.str).join(' ');
    expect(text).toContain('Draft — pending broker review');
    expect(text).toContain('POLICY CHECKING REPORT');
    expect(text).toContain(`Page ${i} of ${doc.numPages}`);
    pages.push({
      text,
      items,
      body: items
        .filter(item => item.y < 710 && item.y > 75 && !item.str.includes('(continued)'))
        .map(item => item.str)
        .join(' '),
    });
  }
  const metadata = await doc.getMetadata();
  await task.destroy();
  return { pages, text: pages.map(p => p.text).join(' '), metadata };
}
const normalize = (text: string) => text.replace(/\s+/g, ' ').trim();
function jsonProvider(
  directory: string,
  state: { mode: 'normal' | 'malformed' | 'missing' },
): OutputProvider<'draftOutput'> {
  return {
    id: 'local-json',
    category: 'draftOutput',
    capabilities: ['immutable-draft', 'local-file'],
    async materialize(request) {
      const validated = draftOutputRequestSchema.parse(request);
      const path = join(directory, validated.operationId + '.json');
      const bytes = Buffer.from(JSON.stringify(validated.snapshot, null, 2));
      await writeFile(path, bytes, { mode: 0o600 });
      return {
        providerId: 'local-json',
        stage: 'draftOutput',
        operationId: validated.operationId,
        snapshotId: validated.snapshotId,
        snapshotHash: state.mode === 'malformed' ? '0'.repeat(64) : validated.snapshotHash,
        hash: hashBytes(bytes),
        displayName: 'policy-check-draft.json',
        mediaType: 'application/json',
        retrievalReference: state.mode === 'missing' ? join(directory, 'absent') : path,
      };
    },
    async retrieve(artifact) {
      return readFile(artifact.retrievalReference);
    },
  };
}

describe('Immutable review drafts across real workflow, database, file and HTTP boundaries', () => {
  it('explains malformed report JSON without changing the saved report or its publication', async () => {
    const runtime = await setup();
    const report = await runtime.compare();
    const publication = await runtime.reportRepository.get(reportContext);
    const record = await runtime.cases.requireCase(reportContext);
    const requestCount = runtime.wire.requests.length;
    const memory = { thread: reportContext.threadId, resource: reportContext.operatorId };
    for (const command of ['/report {caseId: "invalid"}', '/report {"caseId":', '/report not-json']) {
      const response = await runtime.agent.generate(command, { memory });
      expect(response.tripwire?.reason).not.toContain('REPORT_FORMAT');
      expect(response.tripwire?.reason).toContain('The report request is not valid.');
      expect(response.tripwire?.reason).toContain('Show the report');
      expect(response.tripwire?.reason).not.toContain('SERVICE_UNAVAILABLE');
    }
    for (const command of ['/report', `/report ${JSON.stringify({ caseId: record.id, retryPublication: true })}`]) {
      const response = await runtime.agent.generate(command, { memory });
      expect(response.tripwire?.reason).toContain('Reload this conversation');
      expect(await conversationReply(runtime.memory, response.tripwire?.reason ?? response.text)).toContain(
        '[Download draft report](',
      );
      expect(response.tripwire?.reason?.replace(/\]\([^)]*\)/g, ']')).not.toContain(report.report.id);
    }
    expect(await runtime.cases.requireCase(reportContext)).toEqual(record);
    expect(await runtime.reportRepository.get(reportContext)).toEqual(publication);
    expect(runtime.wire.requests).toHaveLength(requestCount);
  });
  it('draft_pdf_preserves_findings_and_paginated_layout', async () => {
    const documents = propertyDocuments();
    for (const document of documents.slice(0, 2))
      document.pages.push(
        Array.from(
          { length: 17 },
          (_, i) => `Condition paragraph ${i + 1}: retain the stated scope and qualifications for this agreement.`,
        ),
      );
    const runtime = await setup(documents, 'long');
    const result = await runtime.compare();
    expect(result.available).toBe(true);
    const { publication, bytes } = await savedPdf(runtime, 'long-findings');
    expect(result.report.comparisons).toHaveLength(19);
    expect(result.report.counts).toEqual({ checked: 19, matches: 4, discrepancies: 14, authorized: 1, unresolved: 0 });
    expect(result.report.status).toBe('REVIEW_REQUIRED');
    const inspection = await inspectPdf(bytes);
    expect(inspection.pages.length).toBeGreaterThan(10);
    for (const page of inspection.pages.filter(p => p.text.includes('Discrepancy summary (continued)'))) {
      expect(page.text).toMatch(/Finding \d{3}/);
      expect(page.text).toContain('Discrepancy identified');
    }
    for (const [index, page] of inspection.pages.entries())
      for (const match of page.text.matchAll(/Source document (\d{3}) \(continued\)/g))
        expect(
          inspection.pages
            .slice(0, index)
            .some(previous => previous.text.includes('Source document ' + match[1] + ' •')),
        ).toBe(true);
    const all = normalize(inspection.text);
    for (const section of [
      'A. Identification',
      'B. Executive summary',
      'C. Discrepancy summary',
      'D. Detailed findings',
      'E. Authorized changes',
      'F. Verified terms',
      'G. Missing evidence and limitations',
      'H. Sources',
      'I. Broker review',
    ])
      expect(all).toContain(section);
    expect(all).toContain('Broker review is required');
    expect(all).toContain('Documented authorized change');
    expect(all).toContain('Expected terms');
    expect(all).toContain('Issued / target terms');
    expect(
      inspection.pages.filter(
        page => page.text.includes('Discrepancy summary (continued)') && page.text.includes('Finding / references'),
      ).length,
    ).toBeGreaterThan(1);
    for (const finding of result.report.comparisons)
      for (const evidence of finding.evidence)
        expect(normalize(inspection.pages.map(page => page.body).join(' '))).toContain(normalize(evidence.excerpt));
    for (const source of result.report.sources) {
      expect(all).toContain(source.sourceId);
      expect(all).toContain(source.hash);
    }
    expect(all).not.toMatch(/REVIEW_REQUIRED|AUTHORIZED_CHANGE|AWAITING_REVIEW|snapshotHash|undefined/);
    const loaded = await PDFDocument.load(bytes);
    expect(loaded.getTitle()).toBe('Policy Checking Report');
    expect(bytes.toString('latin1')).toContain('/FontFile2');
    expect(bytes.toString('latin1')).toContain('NotoSans-Regular');
    expect(bytes.toString('latin1')).toContain('NotoSans-Bold');
    expect(reportHash(publication.snapshot)).toBe(publication.hash);
    for (const change of [
      () => ({ ...result.report, status: 'APPROVED' }),
      () => ({ ...result.report, counts: { ...result.report.counts, checked: 999 } }),
      () => ({
        ...result.report,
        comparisons: result.report.comparisons.map(f => ({
          ...f,
          searched: f.searched.map(scope => ({ ...scope, pages: scope.pages.map(() => 1) })),
        })),
      }),
      () => ({
        ...result.report,
        sources: result.report.sources.map((s, i) => (i ? s : { ...s, kind: 'records', pageCount: 2 })),
      }),
      () => ({
        ...result.report,
        comparisons: result.report.comparisons.map((f, i) =>
          i ? f : { ...f, searched: [{ sourceId: randomUUID(), pages: [1], records: [], complete: true }] },
        ),
      }),
    ])
      expect(reportSnapshotSchema.safeParse(change()).success).toBe(false);
    const zero = await setup(propertyDocuments(), 'zero');
    const zeroResult = await zero.compare();
    expect(zeroResult.report.counts).toEqual({
      checked: 0,
      matches: 0,
      discrepancies: 0,
      authorized: 0,
      unresolved: 0,
    });
    expect(zeroResult.report.status).toBe('INCONCLUSIVE');
    const zeroInspection = await inspectPdf((await savedPdf(zero, 'zero-data')).bytes);
    expect(zeroInspection.text).toContain('No comparable terms were evaluated');
    const executive = zeroInspection.pages.find(page => page.text.includes('B. Executive summary'))!;
    expect(executive.text).toContain('Required comparison documents');
    expect(executive.text).toContain('No comparable terms were evaluated');

    const partial = await setup(propertyDocuments(), 'partial');
    const partialResult = await partial.compare();
    expect(partialResult.report.counts.checked).toBe(0);
    expect(partialResult.report.counts.matches).toBe(0);
    expect(partialResult.report.status).toBe('INCONCLUSIVE');
    expect(partialResult.report.counts.unresolved).toBeGreaterThan(0);
    const matchingDocuments = propertyDocuments().slice(0, 2);
    matchingDocuments[1]!.pages = structuredClone(matchingDocuments[0]!.pages);
    const matching = await setup(matchingDocuments, 'match');
    const matched = await matching.compare();
    expect(matched.report.status).toBe('NO_DISCREPANCIES_DETECTED');
    expect(matched.report.counts).toEqual({ checked: 7, matches: 7, discrepancies: 0, authorized: 0, unresolved: 0 });
    expect((await inspectPdf((await savedPdf(matching, 'matching-terms')).bytes)).text).toContain(
      'No discrepancies were detected',
    );
  });
  it('identifies only supported issued policy dates on the report cover', async () => {
    const documents = propertyDocuments();
    const quotation = 'Policy period: 2026-04-01 through 2027-04-01';
    for (const document of documents.slice(0, 2))
      document.pages[0]!.push(
        quotation,
        'Alternative declaration inception: 2026-05-01',
        'Alternative declaration inception: 2028-04-01',
        'Policy inception year: 2026',
        'Policy inception year: 2028',
        'Policy inception month: 2026-04',
        'Policy inception month: 2028-04',
        'Policy inception month: 2028-05',
        'Policy expiry: 2028-04-01',
      );
    const runtime = await setup(documents);
    const { report } = await runtime.compare();
    const original = report.comparisons.find(finding => finding.key === 'inception')!;
    const dated = (key: string, value: string, scope = 'Policy', uncertain = false) => {
      const finding = structuredClone(original);
      finding.id = randomUUID();
      finding.category = 'policy_period';
      finding.key = key;
      finding.scope = scope;
      finding.label = key === 'inception' ? 'Policy period start' : 'Policy period end';
      for (const term of [finding.baseline!, finding.actual!]) {
        term.category = finding.category;
        term.key = key;
        term.scope = scope;
        term.label = finding.label;
        term.value = {
          type: 'date',
          value,
          granularity: value.length === 4 ? 'year' : value.length === 7 ? 'month' : 'day',
        };
        term.original =
          value.length === 4
            ? 'Policy inception year: ' + value
            : value.length === 7
              ? 'Policy inception month: ' + value
              : key === 'expiry' && value === '2028-04-01'
                ? 'Policy expiry: ' + value
                : quotation.includes(value)
                  ? quotation
                  : 'Alternative declaration inception: ' + value;
        term.evidence = term.evidence.map(evidence => ({ ...evidence, excerpt: term.original }));
        term.uncertainty = uncertain ? ['The declaration date is ambiguous.'] : [];
      }
      finding.evidence = [...finding.baseline!.evidence, ...finding.actual!.evidence];
      return finding;
    };
    const inception = dated('inception', '2026-04-01');
    const expiry = dated('expiry', '2027-04-01');
    const cover = async (dates: typeof report.comparisons, issued = true) => {
      const comparisons = [...report.comparisons.filter(finding => finding.key !== 'inception'), ...dates];
      const snapshot = reportSnapshotSchema.parse({
        ...report,
        comparisons,
        counts: reportCounts(comparisons),
        status: reportStatus(comparisons, false, report.rules.length),
        sources: report.sources.map(source =>
          !issued && source.sourceId === report.targetId ? { ...source, role: 'contract' } : source,
        ),
      });
      return normalize((await inspectPdf(await renderDraftPdf(snapshot))).pages[0]!.text);
    };
    expect(await cover([inception, expiry])).toContain('2026-04-01 to 2027-04-01');
    expect(await cover([])).toContain('Policy dates (issued policy): Not available');
    expect(await cover([inception])).toContain('Starts 2026-04-01; expiry not available');
    expect(await cover([expiry])).toContain('Inception not available; expires 2027-04-01');
    expect(
      await cover([
        { ...inception, actual: null },
        { ...expiry, actual: null },
      ]),
    ).toContain('Policy dates (issued policy): Not available');
    expect(await cover([inception, expiry], false)).toContain('Policy dates (issued policy): Not available');
    expect(
      await cover([dated('inception', '2026-04-01', 'Endorsement'), dated('expiry', '2027-04-01', 'Endorsement')]),
    ).toContain('Policy dates (issued policy): Not available');
    expect(await cover([dated('inception', '2026-04-01', 'Policy', true), expiry])).toContain(
      'Inception requires review; expires 2027-04-01',
    );
    expect(await cover([inception, dated('inception', '2026-05-01', 'Entire policy'), expiry])).toContain(
      'Inception requires review; expires 2027-04-01',
    );
    expect(await cover([dated('inception', '2028-04-01'), expiry])).toContain(
      'Conflicting policy dates; review the issued policy',
    );
    for (const scope of ['Policy endorsement', 'Policy cancellation', 'Policy coverage section'])
      expect(
        await cover([dated('effective_date', '2026-04-01', scope), dated('expiry', '2027-04-01', scope)]),
      ).toContain('Policy dates (issued policy): Not available');
    expect(await cover([dated('inception', '2028'), expiry])).toContain(
      'Conflicting policy dates; review the issued policy',
    );
    expect(await cover([dated('inception', '2026'), expiry])).toContain('2026 to 2027-04-01');
    expect(await cover([dated('inception', '2028'), dated('expiry', '2028-04-01')])).toContain(
      'Policy date order requires review (2028 to 2028-04-01)',
    );
    expect(await cover([dated('inception', '2026-04'), expiry])).toContain('2026-04 to 2027-04-01');
    expect(await cover([dated('inception', '2028-05'), dated('expiry', '2028-04-01')])).toContain(
      'Conflicting policy dates; review the issued policy',
    );
    expect(await cover([dated('inception', '2028-04'), dated('expiry', '2028-04-01')])).toContain(
      'Policy date order requires review (2028-04 to 2028-04-01)',
    );
    expect(
      await cover([
        dated('inception', '2026-04-01', 'Policy CP-4021'),
        dated('expiry', '2027-04-01', 'Policy CP-4021'),
      ]),
    ).toContain('2026-04-01 to 2027-04-01');
  });
  it('pending_review_and_download_survive_restart', async () => {
    const runtime = await setup();
    const result = await runtime.compare();
    const first = await savedPdf(runtime, 'full-case');
    const requestCount = runtime.wire.requests.length;
    const runId = result.workflowRunId;
    expect((await runtime.comparison.workflow.getWorkflowRunById(runId))?.status).toBe('suspended');
    const tool = createReportTool(runtime.caseService, runtime.comparison.report, reportContext.operatorId);
    const requestContext = new RequestContext();
    requestContext.set('insuranceThreadId', reportContext.threadId);
    const toolResult = await tool.execute!(
      { caseId: runtime.request.caseId },
      { requestContext, observe: noopObserve },
    );
    expect(toolResult).toMatchObject({ available: true, snapshotHash: first.publication.hash });
    const explanation = await runtime.agent.generate('/report', {
      memory: { thread: reportContext.threadId, resource: reportContext.operatorId },
    });
    const savedNotice = await conversationReply(runtime.memory, explanation.tripwire?.reason ?? explanation.text);
    expect(savedNotice).toContain('CP-4021');
    expect(explanation.tripwire?.reason?.replace(/\]\([^)]*\)/g, ']')).not.toContain(result.report.id);
    expect(savedNotice).toContain('[Download draft report](');
    const wm = await runtime.memory.getWorkingMemory({ threadId: reportContext.threadId });
    expect(wm).toContain(result.report.id);
    expect(wm).toContain(runId);
    await runtime.close();
    const worker = await execute(
      process.execPath,
      [
        '--import',
        './tests/source-loader.mjs',
        './tests/reports-worker.mjs',
        JSON.stringify({ root: runtime.root, runId, caseId: runtime.request.caseId }),
      ],
      { cwd: process.cwd(), maxBuffer: 8 * 1024 * 1024 },
    );
    const fresh = JSON.parse(worker.stdout.trim().split('\n').at(-1)!) as {
      before: { status: string };
      after: { status: string };
      current: typeof result;
      resumedStatus: string;
      case: { state: string };
      status: { analyses: unknown[]; attempts: unknown[] };
    };
    expect(fresh.before.status).toBe('suspended');
    expect(fresh.after.status).toBe('suspended');
    expect(fresh.resumedStatus).toBe('suspended');
    expect(fresh.case.state).toBe('AWAITING_REVIEW');
    expect(fresh.current.report).toEqual(result.report);
    const deductible = fresh.current.report.comparisons.find(f => f.label === 'Deductible')!;
    expect(deductible.classification).toBe('AUTHORIZED_CHANGE');
    expect(deductible.baseline?.value).toMatchObject({ amount: '2500' });
    expect(deductible.actual?.value).toMatchObject({ amount: '5000' });
    const amendment = fresh.current.report.sources.find(s => s.role === 'amendment')!;
    expect(deductible.evidence).toContainEqual(
      expect.objectContaining({
        sourceId: amendment.sourceId,
        version: amendment.version,
        hash: amendment.hash,
        physicalPage: 1,
        excerpt: expect.stringContaining('Maya Chen approved Deductible'),
      }),
    );
    expect(fresh.status.analyses).toHaveLength(1);
    expect(fresh.status.attempts).toHaveLength(1);
    expect(runtime.wire.requests.length).toBe(requestCount);
    let studio = await startStudio(runtime.root);
    cleanup.push(() => studio.close());
    const download = await fetch(studio.url + result.artifact!.url);
    expect(download.status).toBe(200);
    expect(hashBytes(new Uint8Array(await download.arrayBuffer()))).toBe(first.publication.artifact!.hash);
    expect(download.headers.get('content-type')).toBe('application/pdf');
    expect(download.headers.get('content-disposition')).toContain('-draft.pdf');
    expect(download.headers.get('cache-control')).toBe('no-store');
    const read = await fetch(studio.url + '/api/agents/policyCheckingAgent/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: studio.url },
      body: JSON.stringify({
        messages: [{ role: 'user', content: '/report' }],
        memory: { thread: reportContext.threadId, resource: reportContext.operatorId },
      }),
    });
    const events = (await read.text())
      .split('\n')
      .filter(line => line.startsWith('data: {'))
      .map(line => JSON.parse(line.slice('data: '.length)) as { type: string; payload?: { reason?: string } });
    const transient = events.find(event => event.type === 'tripwire')?.payload?.reason;
    expect(transient).toContain('Reload this conversation');
    expect(transient).not.toMatch(/caseId=|threadId=|\b[a-f0-9]{8}-[a-f0-9-]{27,}\b/);
    const restarted = await reportRuntime(runtime.root, runtime.wire.endpoint);
    cleanup.push(() => restarted.close());
    const text = await conversationReply(restarted.memory, transient ?? '');
    expect(text.replace(/\]\([^)]*\)/g, ']')).not.toContain(result.report.id);
    expect(text).toContain('Your draft is ready');
    expect(text).toContain('Deductible');
    expect(text).toContain('physical page 1');
    expect(text).toContain('2500');
    expect(text).toContain('5000');
    expect(text).toContain('Maya Chen approved Deductible');
    const reportLink = /\[Download draft report\]\(([^)]+)\)/.exec(text);
    expect(reportLink).not.toBeNull();
    expect(reportLink![1]).toBe(result.artifact!.url);
    const linkedDownload = await fetch(studio.url + reportLink![1]);
    expect(linkedDownload.status).toBe(200);
    expect(hashBytes(new Uint8Array(await linkedDownload.arrayBuffer()))).toBe(first.publication.artifact!.hash);
    expect(text).not.toContain('snapshotHash');
    await studio.close();
    studio = await startStudio(runtime.root);
    const repeated = await fetch(studio.url + result.artifact!.url);
    expect(hashBytes(new Uint8Array(await repeated.arrayBuffer()))).toBe(hashBytes(first.bytes));
    expect(runtime.wire.requests.length).toBe(requestCount);
  });
  it('failed_draft_publish_does_not_create_reviewable_link', async () => {
    const runtime = await setup();
    const reports = runtime.reportRepository.root;
    const held = reports + '-held';
    await rename(reports, held);
    await writeFile(reports, 'blocked private report directory');
    const result = await runtime.compare();
    expect(result.available).toBe(false);
    expect(result.artifact).toBeUndefined();
    expect(result.failure?.message).toContain('rendered or saved');
    expect((await runtime.cases.active(reportContext))?.state).toBe('FAILED');
    const original = (await runtime.reportRepository.get(reportContext))!;
    expect(original.state).toBe('FAILED');
    const calls = runtime.wire.requests.length;
    await unlink(reports);
    await rename(held, reports);
    const recovered = (await runtime.comparison.report(reportContext, {
      caseId: runtime.request.caseId,
      retryPublication: true,
    })) as typeof result;
    expect(recovered.available, JSON.stringify(recovered.failure)).toBe(true);
    expect(recovered.report).toEqual(result.report);
    expect(recovered.workflowRunId).toBe(result.workflowRunId);
    expect(recovered.snapshotHash).toBe(original.hash);
    expect(runtime.wire.requests.length).toBe(calls);
    expect((await runtime.reconciliationRepository.status(reportContext)).analyses).toHaveLength(1);
    expect((await runtime.cases.active(reportContext))?.state).toBe('AWAITING_REVIEW');
    const interruptedDirectory = await mkdtemp(join(tmpdir(), 'insurance-interrupted-output-'));
    cleanup.push(() => rm(interruptedDirectory, { recursive: true, force: true }));
    const deterministic = jsonProvider(interruptedDirectory, { mode: 'normal' });
    let partialRuntime: Awaited<ReturnType<typeof setup>>;
    let interruptOnce = true;
    let interruptedBytes: Buffer | undefined;
    const interruptedProvider: OutputProvider<'draftOutput'> = {
      ...deterministic,
      async materialize(request, context) {
        const descriptor = await deterministic.materialize(request, context);
        if (interruptOnce) {
          interruptOnce = false;
          const saved = (await partialRuntime.reportRepository.get(reportContext))!;
          interruptedBytes = Buffer.from(await deterministic.retrieve(descriptor, context)).subarray(0, 40);
          await writeFile(join(context.outputDirectory, saved.artifactId + '-' + descriptor.hash), interruptedBytes, {
            mode: 0o600,
          });
          throw Error('Controlled interruption with incomplete unpublished destination');
        }
        return descriptor;
      },
    };
    partialRuntime = await setup(liabilityDocuments(), 'normal', interruptedProvider, reportRecordInput());
    const interruptedDraft = await partialRuntime.compare();
    expect(interruptedDraft.available).toBe(false);
    expect(interruptedDraft.artifact).toBeUndefined();
    const partialPublication = (await partialRuntime.reportRepository.get(reportContext))!;
    const partialCalls = partialRuntime.wire.requests.length;
    const releaseFile = join(interruptedDirectory, 'release');
    const worker = (readyFile: string) =>
      execute(
        process.execPath,
        [
          '--import',
          './tests/source-loader.mjs',
          './tests/reports-worker.mjs',
          JSON.stringify({
            mode: 'publishDeterministic',
            root: partialRuntime.root,
            destination: interruptedDirectory,
            readyFile,
            releaseFile,
          }),
        ],
        { cwd: process.cwd(), maxBuffer: 8 * 1024 * 1024 },
      );
    const ready = async (path: string) => {
      const deadline = Date.now() + 15000;
      while (true) {
        try {
          await access(path);
          return;
        } catch {
          if (Date.now() > deadline) throw Error('Worker readiness timed out');
          await delay(10);
        }
      }
    };
    const firstReady = join(interruptedDirectory, 'first-ready');
    const firstPublisher = worker(firstReady);
    await ready(firstReady);
    const secondReady = join(interruptedDirectory, 'second-ready');
    const secondPublisher = worker(secondReady);
    await ready(secondReady);
    // An overlapping local write can outlast the native busy timeout.
    // Failed BEGIN statements must not poison the connection used for the later commit.
    const lockReady = join(interruptedDirectory, 'lock-ready');
    const lockHolder = execute(
      process.execPath,
      [
        '--import',
        './tests/source-loader.mjs',
        './tests/reports-worker.mjs',
        JSON.stringify({ mode: 'holdWriteLock', root: partialRuntime.root, readyFile: lockReady, holdMs: 1400 }),
      ],
      { cwd: process.cwd(), maxBuffer: 8 * 1024 * 1024 },
    );
    await ready(lockReady);
    await writeFile(releaseFile, 'publish');
    const competingProcesses = await Promise.all([firstPublisher, secondPublisher]);
    await lockHolder;
    const concurrentResults = competingProcesses.map(p => JSON.parse(p.stdout.trim().split('\n').at(-1)!));
    expect(
      concurrentResults.some(p => p.state === 'PUBLISHED'),
      JSON.stringify(concurrentResults),
    ).toBe(true);
    expect(concurrentResults.every(p => p.state === 'PUBLISHED' || p.ok === false)).toBe(true);
    const resumedPartial = await partialRuntime.comparison.report(reportContext, {
      caseId: partialRuntime.request.caseId,
      retryPublication: true,
    });
    expect(resumedPartial.available, 'An incomplete unpublished destination must not block deterministic retry').toBe(
      true,
    );
    expect(resumedPartial.report).toEqual(interruptedDraft.report);
    expect(resumedPartial.workflowRunId).toBe(interruptedDraft.workflowRunId);
    expect(partialRuntime.wire.requests.length).toBe(partialCalls);
    const retained = await import('node:fs/promises').then(fs => fs.readdir(partialRuntime.reportRepository.root));
    const quarantined = retained.find(
      name => name.startsWith(partialPublication.artifactId + '-') && name.includes('.interrupted-'),
    );
    expect(quarantined).toBeDefined();
    expect(await readFile(join(partialRuntime.reportRepository.root, quarantined!))).toEqual(interruptedBytes);
    const competing = await Promise.all([
      partialRuntime.reports.publish(partialPublication),
      partialRuntime.reports.publish(partialPublication),
    ]);
    expect(competing.every(p => p.state === 'PUBLISHED')).toBe(true);
    const settled = (await partialRuntime.reportRepository.get(reportContext))!;
    const installedPath = join(partialRuntime.reportRepository.root, settled.artifactId + '-' + settled.artifact!.hash);
    expect(hashBytes(await readFile(installedPath))).toBe(settled.artifact!.hash);
    await writeFile(installedPath, 'published integrity must not be repaired');
    await expect(partialRuntime.reports.publish(partialPublication)).rejects.toMatchObject({
      code: 'ARTIFACT_UNAVAILABLE',
    });
    expect(await readFile(installedPath, 'utf8')).toBe('published integrity must not be repaired');
    expect((await partialRuntime.reportRepository.get(reportContext))?.state).toBe('PUBLISHED');
    const metadata = await setup();
    await metadata.cases.client.executeMultiple(
      "CREATE TRIGGER reject_report_publication BEFORE UPDATE ON insurance_reports WHEN json_extract(NEW.data,'$.state')='PUBLISHED' BEGIN SELECT RAISE(ABORT,'Controlled metadata publication fault'); END;",
    );
    const unpublished = await metadata.compare();
    const failedPublication = (await metadata.reportRepository.get(reportContext))!;
    expect(unpublished.available).toBe(false);
    expect(unpublished.artifact).toBeUndefined();
    expect(failedPublication.state).toBe('FAILED');
    const files = await import('node:fs/promises').then(fs => fs.readdir(metadata.reportRepository.root));
    expect(files.some(name => name.startsWith(failedPublication.artifactId + '-'))).toBe(true);
    await expect(
      metadata.reportRepository.download(reportContext, metadata.request.caseId, failedPublication.artifactId),
    ).rejects.toMatchObject({ code: 'ARTIFACT_CONTEXT' });
    const metadataCalls = metadata.wire.requests.length;
    await metadata.cases.client.execute('DROP TRIGGER reject_report_publication');
    const repaired = (await metadata.comparison.report(reportContext, {
      caseId: metadata.request.caseId,
      retryPublication: true,
    })) as typeof unpublished;
    expect(repaired.available).toBe(true);
    expect(repaired.report).toEqual(unpublished.report);
    expect(repaired.workflowRunId).toBe(unpublished.workflowRunId);
    expect(metadata.wire.requests.length).toBe(metadataCalls);
    const checkpointFault = await setup();
    const history = createClient({ url: `file:${join(checkpointFault.root, 'history.db')}` });
    cleanup.push(async () => history.close());
    await history.executeMultiple(
      `CREATE TRIGGER reject_review_checkpoint BEFORE UPDATE ON ${TABLE_WORKFLOW_SNAPSHOT} WHEN json_extract(NEW.snapshot,'$.status')='suspended' BEGIN SELECT RAISE(ABORT,'Controlled native checkpoint fault'); END;`,
    );
    await checkpointFault.comparison.runner.compare(reportContext, checkpointFault.request).catch(() => undefined);
    const published = (await checkpointFault.reportRepository.get(reportContext))!;
    expect(published.state).toBe('PUBLISHED');
    expect((await checkpointFault.cases.active(reportContext))?.state).toBe('AWAITING_REVIEW');
    expect(
      (await checkpointFault.comparison.workflow.getWorkflowRunById(published.snapshot.workflowRunId))?.status,
    ).not.toBe('suspended');
    const interrupted = await checkpointFault.comparison.report(reportContext, {
      caseId: checkpointFault.request.caseId,
    });
    expect(interrupted).toMatchObject({ available: true, checkpointState: 'INTERRUPTED' });
    await history.execute('DROP TRIGGER reject_review_checkpoint');
    const beforeRepair = checkpointFault.wire.requests.length;
    const fixed = await checkpointFault.comparison.report(reportContext, {
      caseId: checkpointFault.request.caseId,
      retryPublication: true,
    });
    expect(fixed).toMatchObject({
      available: true,
      checkpointState: 'SUSPENDED',
      snapshotHash: published.hash,
      workflowRunId: published.snapshot.workflowRunId,
    });
    expect(checkpointFault.wire.requests.length).toBe(beforeRepair);
    const orphan = await setup();
    const originalRun = randomUUID();
    await orphan.reconciliation.process(reportContext, orphan.request, originalRun, true);
    const paidRequests = orphan.wire.requests.length;
    expect((await orphan.cases.active(reportContext))?.state).toBe('PROCESSING');
    await orphan.close();
    const recoveredProcess = await execute(
      process.execPath,
      [
        '--import',
        './tests/source-loader.mjs',
        './tests/reports-worker.mjs',
        JSON.stringify({ mode: 'recoverOrphan', root: orphan.root, runId: originalRun, caseId: orphan.request.caseId }),
      ],
      { cwd: process.cwd(), maxBuffer: 8 * 1024 * 1024 },
    );
    const recoveredOrphan = JSON.parse(recoveredProcess.stdout.trim().split('\n').at(-1)!);
    expect(recoveredOrphan.current.available).toBe(true);
    expect(recoveredOrphan.current.workflowRunId).toBe(originalRun);
    expect(recoveredOrphan.state.status).toBe('suspended');
    expect(orphan.wire.requests.length).toBe(paidRequests);
    const changed = await setup();
    await changed.reconciliation.process(reportContext, changed.request, randomUUID());
    const changedRecord = (await changed.cases.active(reportContext))!;
    const savedCalls = changed.wire.requests.length;
    await changed.caseService.clarify(reportContext, {
      ...changedRecord.clarification!,
      expectedRevision: changedRecord.revision,
      identity: { ...changedRecord.identity, policyNumber: 'CP-REVISED' },
    });
    expect((await changed.cases.active(reportContext))?.latestAnalysisId).toBeUndefined();
    await expect(
      changed.comparison.report(reportContext, { caseId: changed.request.caseId, retryPublication: true }),
    ).rejects.toMatchObject({ code: 'REPORT_UNAVAILABLE' });
    expect((await changed.reconciliationRepository.status(reportContext)).analyses).toHaveLength(1);
    expect(changed.wire.requests.length).toBe(savedCalls);
    await writeFile(join(reports, original.artifactId + '-' + recovered.artifact!.hash), 'corrupted');
    const damaged = await runtime.reports.current(reportContext, { caseId: runtime.request.caseId });
    expect(damaged.available).toBe(false);
    expect(damaged.artifact).toBeUndefined();
    expect(damaged.failure?.message).toContain('checksum');
  });
  it('rejects_cross_origin_mutations_and_unbound_artifacts', async () => {
    const runtime = await setup();
    const result = await runtime.compare();
    const publication = (await runtime.reportRepository.get(reportContext))!;
    await runtime.close();
    const studio = await startStudio(runtime.root);
    cleanup.push(studio.close);
    const link = studio.url + result.artifact!.url;
    expect((await fetch(link, { headers: { Origin: studio.url } })).status).toBe(200);
    for (const url of [
      link.replace(reportContext.threadId, 'other-thread'),
      link.replace(result.report.caseId, randomUUID()),
      link.replace(result.artifact!.id, randomUUID()),
      studio.url +
        '/insurance/artifacts/..%2F..%2F.env?caseId=' +
        result.report.caseId +
        '&threadId=' +
        reportContext.threadId,
    ])
      expect((await fetch(url)).status).toBeGreaterThanOrEqual(400);
    expect(await requestHost(link, 'attacker.invalid')).toBe(403);
    expect((await fetch(link, { headers: { Origin: 'https://attacker.invalid' } })).status).toBe(403);
    for (const path of [
      '/api/agents/policyCheckingAgent/stream',
      '/api/agents/policyCheckingAgent/tools/policyReport/execute',
      '/api/workflows/policyCheckingWorkflow/start',
      '/api/workflows/policyCheckingWorkflow/' + result.workflowRunId + '/resume',
    ])
      expect(
        (
          await fetch(studio.url + path, {
            method: 'POST',
            headers: { Origin: 'https://attacker.invalid', 'Content-Type': 'application/json' },
            body: JSON.stringify({ approved: true }),
          })
        ).status,
      ).toBe(403);
    const artifactPath = join(runtime.reportRepository.root, publication.artifactId + '-' + publication.artifact!.hash);
    const backup = artifactPath + '-backup';
    await rename(artifactPath, backup);
    expect((await fetch(link)).status).toBe(409);
    await symlink(backup, artifactPath);
    expect((await fetch(link)).status).toBe(409);
    await unlink(artifactPath);
    await rename(backup, artifactPath);
    expect((await fetch(link)).status).toBe(200);
  });
  it('output_adapter_preserves_report_contract_and_publish_failures', async () => {
    const destination = await mkdtemp(join(tmpdir(), 'insurance-json-output-'));
    cleanup.push(() => rm(destination, { recursive: true, force: true }));
    const state: { mode: 'normal' | 'malformed' | 'missing' } = { mode: 'normal' };
    const provider = jsonProvider(destination, state);
    const runtime = await setup(liabilityDocuments(), 'normal', provider, reportRecordInput());
    const result = await runtime.compare();
    expect(result.available).toBe(true);
    expect(result.report.intent).toBe('document_comparison');
    expect(result.report.identity.policyNumber).toBeNull();
    expect(result.report.sources.every(s => s.pageCount === null)).toBe(true);
    const publication = (await runtime.reportRepository.get(reportContext))!;
    const bytes = await runtime.reportRepository.bytes(publication);
    expect(JSON.parse(bytes.toString())).toEqual(result.report);
    expect(
      result.report.comparisons[0]!.evidence.every(
        e => e.physicalPage === null && e.recordId === 'policy' && e.field === 'assistance',
      ),
    ).toBe(true);
    const pdfService = createReportService(runtime.reportRepository, createDraftPdfProvider());
    expect((await pdfService.current(reportContext, { caseId: runtime.request.caseId })).report).toEqual(result.report);
    const pdf = await setup(liabilityDocuments(), 'normal', undefined, reportRecordInput());
    const pdfResult = await pdf.compare();
    const rendered = await inspectPdf((await savedPdf(pdf, 'professional-records')).bytes);
    expect(rendered.text).toContain('Record policy, field assistance');
    expect(rendered.text).toContain('Not applicable; captured records and fields');
    expect(pdfResult.report.counts.discrepancies).toBe(1);
    expect(rendered.text).toContain('Document comparison');
    for (const mode of ['malformed', 'missing'] as const) {
      state.mode = mode;
      const invalid = await setup(liabilityDocuments(), 'normal', provider, reportRecordInput());
      const failed = await invalid.compare();
      expect(failed.available).toBe(false);
      expect(failed.artifact).toBeUndefined();
      expect((await invalid.cases.active(reportContext))?.state).toBe('FAILED');
      const p = (await invalid.reportRepository.get(reportContext))!;
      const changedProvider = createReportService(invalid.reportRepository, createDraftPdfProvider());
      await expect(changedProvider.publish(p)).rejects.toMatchObject({ code: 'PROVIDER_CONFIGURATION' });
      expect((await invalid.reportRepository.get(reportContext))?.providerId).toBe('local-json');
    }
    state.mode = 'normal';
    const badName = {
      ...provider,
      id: 'bad-name',
      async materialize(
        request: Parameters<typeof provider.materialize>[0],
        context: Parameters<typeof provider.materialize>[1],
      ) {
        return {
          ...(await provider.materialize(request, context)),
          providerId: 'bad-name',
          displayName: '../../private.json',
        };
      },
    };
    const invalidName = await setup(liabilityDocuments(), 'normal', badName, reportRecordInput());
    expect((await invalidName.compare()).available).toBe(false);
    const arrays = { input: [], draftOutput: [provider], reportOutput: [], correctionOutput: [] };
    expect(
      createRegistry(arrays, { draftOutput: provider.id }).resolve('draftOutput', undefined, 'immutable-draft'),
    ).toBe(provider);
    expect(() => createRegistry({ ...arrays, draftOutput: [provider, provider] }, {})).toThrow();
    expect(() => createRegistry(arrays, { draftOutput: 'absent' })).toThrow();
    expect(() =>
      createRegistry(
        {
          ...arrays,
          draftOutput: [],
          reportOutput: [
            {
              ...provider,
              category: 'reportOutput',
              async materialize() {
                throw Error('Final output is not authorized.');
              },
            },
          ],
        },
        {},
      ).resolve('draftOutput', provider.id),
    ).toThrow();
    expect(() => createRegistry(arrays, {}).resolve('draftOutput', provider.id, 'unsupported')).toThrow();
    const request = {
      stage: 'draftOutput',
      operationId: randomUUID(),
      snapshotId: result.report.id,
      snapshotHash: result.snapshotHash,
      snapshot: result.report,
    };
    expect(draftOutputRequestSchema.safeParse({ ...request, snapshotHash: '0'.repeat(64) }).success).toBe(false);
    expect(draftOutputRequestSchema.safeParse({ ...request, approval: { id: randomUUID() } }).success).toBe(false);
    for (const schema of [reportOutputRequestSchema, correctionOutputRequestSchema])
      expect(
        schema.safeParse({
          ...request,
          stage: schema === reportOutputRequestSchema ? 'reportOutput' : 'correctionOutput',
        }).success,
      ).toBe(false);
    // A malformed descriptor never gains a download, even when the provider's bytes exist.
    const selected = (await runtime.cases.active(reportContext))!;
    await runtime.caseService.capture(reportContext, {}, true);
    expect((await runtime.cases.active(reportContext))?.id).not.toBe(selected.id);
    await expect(
      runtime.reportRepository.download(reportContext, selected.id, publication.artifactId),
    ).rejects.toMatchObject({ code: 'CASE_CONTEXT' });
    expect(
      await readFile(join(runtime.reportRepository.root, publication.artifactId + '-' + publication.artifact!.hash)),
    ).toEqual(bytes);
    await expect(runtime.cases.select({ ...reportContext, threadId: 'unrelated' }, selected.id)).rejects.toMatchObject({
      code: 'CASE_CONTEXT',
    });
    await runtime.cases.select(reportContext, selected.id);
    expect((await runtime.reports.current(reportContext, { caseId: selected.id })).report).toEqual(result.report);
    expect((await runtime.reportRepository.download(reportContext, selected.id, publication.artifactId)).bytes).toEqual(
      bytes,
    );
    await runtime.close();
    const studio = await startStudio(runtime.root);
    cleanup.push(studio.close);
    const download = await fetch(studio.url + result.artifact!.url);
    expect(download.status).toBe(200);
    expect(download.headers.get('content-type')).toBe('application/json');
    const downloaded = Buffer.from(await download.arrayBuffer());
    expect(downloaded).toEqual(bytes);
    expect(hashBytes(downloaded)).toBe(publication.artifact!.hash);
  });
});
