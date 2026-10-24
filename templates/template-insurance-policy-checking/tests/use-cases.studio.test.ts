import { expect, test, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { CaseRepository } from '../src/mastra/storage/case-repository.js';
import { FinalizationRepository } from '../src/mastra/storage/finalization-repository.js';
import { ReconciliationRepository } from '../src/mastra/storage/reconciliation-repository.js';
import { ReportRepository } from '../src/mastra/storage/report-repository.js';
import { ReviewRepository } from '../src/mastra/storage/review-repository.js';
import { startStudio } from './http-server.js';
import { fixtureFiles, liabilityDocuments, propertyDocuments } from './reconciliation-fixtures.js';
import { reportWire } from './report-provider.js';
import { reportTestBudget } from './report-runtime.js';

async function send(page: Page, text: string) {
  await page.getByPlaceholder('Enter your message...').fill(text);
  const response = page.waitForResponse(
    r =>
      r.request().method() === 'POST' && /\/(stream|send-message|stream-until-idle)$/.test(new URL(r.url()).pathname),
  );
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await (await response).finished();
  await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeVisible();
}
async function pdfText(path: string) {
  const task = getDocument({ data: new Uint8Array(await readFile(path)), useSystemFonts: false });
  const document = await task.promise;
  const pages: string[] = [];
  for (let i = 1; i <= document.numPages; i++)
    pages.push(
      (await (await document.getPage(i)).getTextContent()).items
        .filter(item => 'str' in item)
        .map(item => item.str)
        .join(' '),
    );
  await task.destroy();
  return pages.join(' ');
}
for (const property of [true, false]) {
  test(
    property
      ? 'commercial_property_studio_use_case_completes'
      : 'non_property_insurance_case_uses_same_pdf_review_pipeline',
    async ({ page }, info) => {
      test.setTimeout(180_000);
      const root = await mkdtemp(join(tmpdir(), 'insurance-full-studio-'));
      const documents = property ? propertyDocuments({ instructions: true }) : liabilityDocuments();
      const wire = await reportWire(documents);
      let studio: Awaited<ReturnType<typeof startStudio>> | undefined;
      let cases: CaseRepository | undefined;
      let threadId: string | undefined;
      const capturedLogs: string[] = [];
      page.on('request', request => {
        if (request.method() !== 'POST') return;
        try {
          const body = request.postDataJSON() as { memory?: { thread?: string | { id: string } }; threadId?: string };
          threadId ??=
            typeof body.memory?.thread === 'string' ? body.memory.thread : (body.memory?.thread?.id ?? body.threadId);
        } catch {}
      });
      try {
        studio = await startStudio(root, wire.endpoint, property ? reportTestBudget : null);
        await page.goto(studio.url);
        await page.getByText('Policy Checking', { exact: true }).click();
        await expect(page.getByPlaceholder('Enter your message...')).toBeVisible();
        const files = await fixtureFiles(documents);
        for (const file of files.files) {
          await page.getByRole('button', { name: 'Add attachment', exact: true }).click();
          const chooser = page.waitForEvent('filechooser');
          await page.getByRole('button', { name: 'Add a local file', exact: true }).click();
          await (
            await chooser
          ).setFiles({
            name: file.name,
            mimeType: 'application/pdf',
            buffer: Buffer.from(file.data.split(',')[1]!, 'base64'),
          });
        }
        await send(page, 'Capture these insurance documents and retain their physical-page evidence.');
        await expect(page.getByText(/Captured 3 immutable source|Captured 2 immutable source/).last()).toBeVisible();
        expect(threadId).toBeTruthy();
        const context = { operatorId: 'local-broker', threadId: threadId! };
        cases = new CaseRepository(root);
        const reconciliation = new ReconciliationRepository(cases);
        const reports = new ReportRepository(reconciliation);
        const reviews = new ReviewRepository(reports);
        const finals = new FinalizationRepository(reviews);
        const captured = await cases.requireCase(context);
        const sources = await cases.sources(context);
        await send(
          page,
          '/clarify ' +
            JSON.stringify({
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
                role: i === 0 ? 'proposal' : i === 1 ? (property ? 'issued_policy' : 'contract') : 'amendment',
              })),
              acceptedBaseline: property
                ? {
                    sourceId: sources[0]!.sourceId,
                    statement: 'The broker records acceptance of this captured proposal.',
                  }
                : null,
            }),
        );
        const clarified = await cases.requireCase(context);
        await send(
          page,
          '/compare ' +
            JSON.stringify({
              caseId: captured.id,
              expectedRevision: clarified.revision,
              profileId: 'generic',
              asOf: '2026-05-01',
              retryAttemptId: null,
            }),
        );
        await expect.poll(async () => (await cases!.requireCase(context)).state).toBe('AWAITING_REVIEW');
        if (!property) {
          const status = await reconciliation.status(context);
          expect(status.attempts[0]!.input.budget).toMatchObject({
            maxAttempts: 1,
            maxRequests: 5,
            maxCostMicros: 5000000,
          });
          expect(wire.requests.length).toBeLessThanOrEqual(5);
        }
        const publication = (await reports.get(context))!;
        expect(await reviews.approval(context, publication.snapshot.id)).toBeNull();
        expect(await finals.get(context, publication.snapshot.id)).toBeNull();
        await send(page, '/report');
        // Native Studio renders persisted processor replies as Markdown when reopening history.
        const callsBeforeReload = wire.requests.length;
        await page.reload();
        await expect(
          page.getByText(new RegExp('Draft available: version ' + publication.snapshot.version + ' for')),
        ).toBeVisible();
        expect((await reports.get(context))!.hash).toBe(publication.hash);
        expect(wire.requests).toHaveLength(callsBeforeReload);
        const evidenceDirectory = resolve(
          process.env.POLICY_EVIDENCE_DIR ?? '.runtime/use-case-downloads',
          property ? 'property' : 'liability',
        );
        await mkdir(evidenceDirectory, { recursive: true });
        const download = page.waitForEvent('download', { timeout: 20_000 });
        await page
          .getByRole('link', { name: /Download draft/ })
          .last()
          .click();
        const draftPath = join(evidenceDirectory, 'draft.pdf');
        await (await download).saveAs(draftPath);
        const draftText = await pdfText(draftPath);
        expect(draftText).toContain('Draft — pending broker review');
        expect(draftText).toContain(property ? 'Warehouse B' : 'Response assistance');
        if (property)
          expect(publication.snapshot.comparisons.find(f => f.key === 'property')?.classification).toBe(
            'AUTHORIZED_CHANGE',
          );
        else expect(draftText).not.toMatch(/Warehouse|Building limit|Water damage|CP-4021/);
        const callsBeforeFollowup = wire.requests.length;
        await send(page, `/evidence ${sources[0]!.sourceId} ${property ? 2 : 1}`);
        await expect(
          page.getByText(property ? /Warehouse B \| 20 Cedar Lane/ : /Retroactive date: 2023-07-01/).last(),
        ).toBeVisible();
        await send(page, '/report');
        expect(wire.requests).toHaveLength(callsBeforeFollowup);
        expect((await cases.requireCase(context)).state).toBe('AWAITING_REVIEW');
        if (property) {
          const session = new URL(page.url()).pathname + new URL(page.url()).search;
          capturedLogs.push(studio.logs());
          await studio.close();
          studio = await startStudio(root, wire.endpoint, property ? reportTestBudget : null);
          await page.goto(studio.url + session);
          await expect(page.getByPlaceholder('Enter your message...')).toBeVisible();
          await send(page, '/report');
          expect((await reports.get(context))!.hash).toBe(publication.hash);
          expect((await cases.requireCase(context)).state).toBe('AWAITING_REVIEW');
        }
        const record = await cases.requireCase(context);
        const missing = publication.snapshot.comparisons.find(f => f.key === 'warehouse-b');
        const request = {
          operationId: randomUUID(),
          caseId: record.id,
          reportId: publication.snapshot.id,
          version: publication.snapshot.version,
          snapshotHash: publication.hash,
          expectedRevision: record.revision,
          expectedState: 'AWAITING_REVIEW',
          action: 'approve',
          dispositions: property
            ? [{ findingId: missing!.id, disposition: 'confirmed', reason: null, severityOverride: null }]
            : [],
        };
        await send(page, '/review ' + JSON.stringify(request));
        await expect.poll(async () => (await cases!.requireCase(context)).state).toBe('FINALIZED');
        await page.reload();
        await expect(page.getByRole('link', { name: 'Download final report', exact: true }).last()).toBeVisible();
        const finalDownload = page.waitForEvent('download', { timeout: 20_000 });
        await page.getByRole('link', { name: 'Download final report', exact: true }).last().click();
        const finalPath = join(evidenceDirectory, 'final.pdf');
        await (await finalDownload).saveAs(finalPath);
        const finalText = await pdfText(finalPath);
        expect(finalText).not.toContain('Draft — pending broker review');
        expect(finalText).toContain('Approved by the broker');
        const approval = await reviews.approval(context, publication.snapshot.id);
        expect(approval).toMatchObject({
          snapshotHash: publication.hash,
          version: publication.snapshot.version,
          reviewerId: context.operatorId,
        });
        if (property) {
          const correctionDownload = page.waitForEvent('download', { timeout: 20_000 });
          await page.getByRole('link', { name: 'Download editable correction draft', exact: true }).last().click();
          const correctionPath = join(evidenceDirectory, 'correction.md');
          await (await correctionDownload).saveAs(correctionPath);
          const correction = await readFile(correctionPath, 'utf8');
          expect(correction).toContain('Warehouse B');
          expect(correction).not.toContain('Deductible');
          const correctionHeadings = correction.match(/^## Finding .*$/gm) ?? [];
          expect(correctionHeadings).toHaveLength(1);
          expect(correctionHeadings[0]).toContain('Warehouse B');
          expect(correction).not.toContain(publication.snapshot.comparisons.find(f => f.key === 'property')!.id);
          await info.attach('correction', { path: correctionPath, contentType: 'text/markdown' });
        } else {
          expect(finalText).not.toMatch(/Warehouse|Building limit|Water damage|CP-4021/);
          await expect(page.getByRole('link', { name: 'Download editable correction draft', exact: true })).toHaveCount(
            0,
          );
        }
        expect(wire.requests).toHaveLength(callsBeforeFollowup);
        await info.attach('draft', { path: draftPath, contentType: 'application/pdf' });
        await info.attach('final', { path: finalPath, contentType: 'application/pdf' });
        await page.getByRole('link', { name: 'Download final report', exact: true }).last().scrollIntoViewIfNeeded();
        await page.screenshot({ path: join(evidenceDirectory, 'final-studio.png') });
        capturedLogs.push(studio.logs());
        await info.attach('operational-logs', { body: capturedLogs.join('\n'), contentType: 'text/plain' });
      } finally {
        cases?.close();
        await studio?.close();
        await wire.close();
        await rm(root, { recursive: true, force: true });
      }
    },
  );
}
