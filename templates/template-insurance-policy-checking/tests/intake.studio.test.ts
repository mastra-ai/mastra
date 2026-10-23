import { test, expect, type Page } from '@playwright/test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LibSQLStore } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { CaseRepository } from '../src/mastra/storage/cases.js';
import { hashBytes } from '../src/mastra/domain/contracts.js';
import { controlledProvider, startStudio } from './http.js';
import { policyPdf } from './fixtures.js';
import { workingMemorySchema } from '../src/mastra/processors/document-intake-processor.js';
import { inputLimits } from '../src/config/limits.js';

async function openAgent(page: Page, url: string) {
  await page.goto(url);
  await page.getByText('Policy Checking', { exact: true }).click();
  await expect(page.getByPlaceholder('Enter your message...')).toBeVisible();
}
async function send(page: Page, text: string, files?: { name: string; buffer: Buffer }[], budgetDisabled = false) {
  const acknowledgement = budgetDisabled
    ? page.getByText(/Conversation model dispatch is disabled until an explicit spending budget/)
    : page.getByText('The PDFs were captured locally. Please identify the document roles and comparison intent.', {
        exact: true,
      });
  const before = await acknowledgement.count();
  for (const file of files ?? []) {
    await page.getByRole('button', { name: 'Add attachment', exact: true }).click();
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Add a local file', exact: true }).click();
    await (await chooser).setFiles({ ...file, mimeType: 'application/pdf' });
  }
  await page.getByPlaceholder('Enter your message...').fill(text);
  const finished = page.waitForResponse(
    response =>
      response.request().method() === 'POST' &&
      /\/(stream|send-message|stream-until-idle)$/.test(new URL(response.url()).pathname),
  );
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await (await finished).finished();
  if (budgetDisabled) await expect(acknowledgement.last()).toBeVisible();
  else await expect(acknowledgement).toHaveCount(before + 1);
  await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeVisible();
}

test('studio_attachments_persist_page_evidence', async ({ browser, page }) => {
  const root = await mkdtemp(join(tmpdir(), 'insurance-studio-'));
  const provider = await controlledProvider();
  let studio: Awaited<ReturnType<typeof startStudio>> | undefined;
  let repository: CaseRepository | undefined;
  const threads: string[] = [];
  const captureThread = (browserPage: Page) =>
    browserPage.on('request', request => {
      if (request.method() !== 'POST') return;
      try {
        const body = request.postDataJSON() as { memory?: { thread?: string | { id: string } }; threadId?: string };
        const thread =
          typeof body.memory?.thread === 'string' ? body.memory.thread : (body.memory?.thread?.id ?? body.threadId);
        if (thread && !threads.includes(thread)) threads.push(thread);
      } catch {}
    });
  captureThread(page);
  const proposal = await policyPdf('Unaccepted proposal SYN-CP-001', 2, { printedLabels: true });
  const policyContent = await policyPdf('Issued policy SYN-CP-001', 3, { blankPage: true });
  const policy = Buffer.concat([
    policyContent,
    Buffer.alloc(inputLimits.pdf.maxBytesPerFile - policyContent.length, 32),
  ]);
  try {
    studio = await startStudio(root, provider.url);
    await openAgent(page, studio.url);
    await send(page, 'Capture these policy documents. Please ask for intent and roles.', [
      { name: 'proposal.pdf', buffer: proposal },
      { name: 'policy.pdf', buffer: policy },
      { name: 'duplicate-policy.pdf', buffer: policy },
    ]);
    await expect(
      page.getByText('The PDFs were captured locally. Please identify the document roles and comparison intent.', {
        exact: true,
      }),
    ).toBeVisible();
    expect(threads).toHaveLength(1);
    repository = new CaseRepository(root);
    const context = { operatorId: 'local-broker', threadId: threads[0]! };
    const record = await repository.requireCase(context);
    expect(record.sourceIds).toHaveLength(2);
    const sources = await repository.sources(context);
    expect(sources.map(source => source.hash)).toEqual([hashBytes(proposal), hashBytes(policy)]);
    for (const [index, source] of sources.entries()) {
      expect(await readFile(join(root, 'sources', `${source.sourceId}.pdf`))).toEqual(index === 0 ? proposal : policy);
      expect(source.kind).toBe('pdf');
      if (source.kind === 'pdf') {
        expect(source.pages.map(part => part.physicalPage)).toEqual(index === 0 ? [1, 2] : [1, 2, 3]);
        expect(source.pages[0]?.text).toContain(index === 0 ? 'Unaccepted proposal' : 'Issued policy');
      }
    }
    const pageTwo = await repository.evidence(context, record.sourceIds[0]!, { physicalPage: 2 });
    expect(pageTwo).toMatchObject({ physicalPage: 2 });
    expect(JSON.stringify(pageTwo)).toContain('Printed label 11');
    expect(sources[1]?.limitations.join(' ')).toContain('Blank physical page');
    const clarification = {
      caseId: record.id,
      expectedRevision: record.revision,
      identity: {
        policyNumber: 'SYN-CP-001',
        insuredName: 'Elm Harbor Fabrication LLC',
        insuranceProduct: 'Commercial property',
      },
      intent: 'document_comparison',
      referenceId: record.sourceIds[0],
      targetId: record.sourceIds[1],
      roles: [
        { sourceId: record.sourceIds[0], role: 'proposal' },
        { sourceId: record.sourceIds[1], role: 'issued_policy' },
      ],
      acceptedBaseline: null,
    };
    await send(page, `/clarify ${JSON.stringify(clarification)}`);
    expect((await repository.requireCase(context)).identity.policyNumber).toBe('SYN-CP-001');
    const firstSession = new URL(page.url()).pathname + new URL(page.url()).search;
    const secondPage = await browser.newPage();
    captureThread(secondPage);
    await openAgent(secondPage, studio.url);
    const secondBytes = await policyPdf('General liability proposal GL-002', 2);
    await send(secondPage, 'Capture this liability proposal for a different case.', [
      { name: 'liability.pdf', buffer: secondBytes },
    ]);
    expect(threads).toHaveLength(2);
    const secondContext = { operatorId: 'local-broker', threadId: threads[1]! };
    const second = await repository.requireCase(secondContext);
    expect(second.id).not.toBe(record.id);
    const secondSession = new URL(secondPage.url()).pathname + new URL(secondPage.url()).search;
    expect(provider.requests.length).toBeGreaterThanOrEqual(6);
    for (const request of provider.requests) {
      const text = JSON.stringify(request);
      expect(text).not.toContain('data:application/pdf');
      expect(text).not.toContain(proposal.toString('base64'));
      expect(text).not.toContain('"type":"file"');
    }
    repository.close();
    repository = undefined;
    await studio.close();
    studio = undefined;
    // A new installed server process reads the same real database/artifact pair.
    studio = await startStudio(root, provider.url);
    await page.goto(studio.url + firstSession);
    await expect(
      page.getByText('Capture these policy documents. Please ask for intent and roles.', { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText('The PDFs were captured locally. Please identify the document roles and comparison intent.', {
        exact: true,
      }),
    ).toHaveCount(2);
    await send(page, '/status');
    await secondPage.goto(studio.url + secondSession);
    await expect(
      secondPage.getByText('Capture this liability proposal for a different case.', { exact: true }),
    ).toBeVisible();
    await expect(
      secondPage.getByText(
        'The PDFs were captured locally. Please identify the document roles and comparison intent.',
        { exact: true },
      ),
    ).toHaveCount(1);
    await send(secondPage, '/status');
    repository = new CaseRepository(root);
    expect((await repository.requireCase(context)).identity.policyNumber).toBe('SYN-CP-001');
    expect((await repository.requireCase(secondContext)).id).toBe(second.id);
    expect(await repository.evidence(context, record.sourceIds[0]!, { physicalPage: 2 })).toEqual(pageTwo);
    const storage = new LibSQLStore({ id: 'verify-history', url: `file:${join(root, 'history.db')}` });
    const memory = new Memory({
      storage,
      options: {
        lastMessages: 20,
        semanticRecall: false,
        workingMemory: { enabled: true, scope: 'thread', schema: workingMemorySchema, agentManaged: false },
      },
    });
    const firstMemory = JSON.parse(
      (await memory.getWorkingMemory({ threadId: context.threadId, resourceId: 'policy-checking-agent' }))!,
    );
    const secondMemory = JSON.parse(
      (await memory.getWorkingMemory({ threadId: secondContext.threadId, resourceId: 'policy-checking-agent' }))!,
    );
    expect(firstMemory.activeCaseId).toBe(record.id);
    expect(firstMemory.activePolicyNumber).toBe('SYN-CP-001');
    expect(secondMemory.activeCaseId).toBe(second.id);
    expect(secondMemory.activePolicyNumber).toBeNull();
    const history = await memory.recall({ threadId: context.threadId, resourceId: 'policy-checking-agent' });
    expect(JSON.stringify(history.messages)).toContain('SYN-CP-001');
    expect(JSON.stringify(history.messages)).toContain('Capture these policy');
    expect(JSON.stringify(history.messages)).not.toContain('data:application/pdf');
    const toolReplies = provider.requests.flatMap(request =>
      (request.messages as { role: string; content: unknown }[])
        .filter(message => message.role === 'tool')
        .map(message => JSON.stringify(message.content)),
    );
    expect(toolReplies.some(reply => reply.includes(record.id) && reply.includes(hashBytes(proposal)))).toBe(true);
    expect(
      toolReplies.some(reply => reply.includes('SYN-CP-001') && reply.includes('Elm Harbor Fabrication LLC')),
    ).toBe(true);
    const latestRequests = provider.requests.slice(-4).map(request => JSON.stringify(request));
    expect(latestRequests[0]).toContain('SYN-CP-001');
    expect(latestRequests[2]).not.toContain(record.id);
    await secondPage.close();
    await storage.close();
    repository.close();
    repository = undefined;
    await studio.close();
    studio = undefined;
    const requestCount = provider.requests.length;
    studio = await startStudio(root);
    const defaultPage = await browser.newPage();
    captureThread(defaultPage);
    await openAgent(defaultPage, studio.url);
    await send(
      defaultPage,
      'Capture a separate default-budget intake.',
      [{ name: 'default-policy.pdf', buffer: secondBytes }],
      true,
    );
    expect(threads).toHaveLength(3);
    const defaultContext = { operatorId: 'local-broker', threadId: threads[2]! };
    repository = new CaseRepository(root);
    const defaultCase = await repository.requireCase(defaultContext);
    expect(defaultCase.sourceIds).toHaveLength(1);
    expect(provider.requests).toHaveLength(requestCount);
    await send(defaultPage, '/status', undefined, true);
    expect(threads).toHaveLength(3);
    expect((await repository.requireCase(defaultContext)).id).toBe(defaultCase.id);
    await defaultPage.locator(`a[href="/agents/policy-checking-agent/threads/${defaultContext.threadId}"]`).click();
    await expect(defaultPage.getByText('Capture a separate default-budget intake.', { exact: true })).toBeVisible();
    const defaultSession = new URL(defaultPage.url()).pathname + new URL(defaultPage.url()).search;
    repository.close();
    repository = undefined;
    await studio.close();
    studio = undefined;
    studio = await startStudio(root);
    await defaultPage.goto(studio.url + defaultSession);
    await expect(defaultPage.getByText('Capture a separate default-budget intake.', { exact: true })).toBeVisible();
    await send(defaultPage, '/status', undefined, true);
    const defaultStorage = new LibSQLStore({ id: 'verify-default-history', url: `file:${join(root, 'history.db')}` });
    const defaultMemory = new Memory({
      storage: defaultStorage,
      options: {
        lastMessages: 20,
        semanticRecall: false,
        workingMemory: { enabled: true, scope: 'thread', schema: workingMemorySchema, agentManaged: false },
      },
    });
    expect(
      JSON.parse(
        (await defaultMemory.getWorkingMemory({
          threadId: defaultContext.threadId,
          resourceId: 'policy-checking-agent',
        }))!,
      ).activeCaseId,
    ).toBe(defaultCase.id);
    const defaultHistory = await defaultMemory.recall({
      threadId: defaultContext.threadId,
      resourceId: 'policy-checking-agent',
    });
    expect(JSON.stringify(defaultHistory.messages)).toContain('Capture a separate default-budget intake.');
    expect(JSON.stringify(defaultHistory.messages)).not.toContain('data:application/pdf');
    expect(provider.requests).toHaveLength(requestCount);
    await defaultStorage.close();
    await defaultPage.close();
  } finally {
    repository?.close();
    await studio?.close();
    await provider.close();
    await rm(root, { recursive: true, force: true });
  }
});
