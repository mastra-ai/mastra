/**
 * COR-1519 cell 4 in a real browser: the shipped Studio chat (thread signals,
 * useChat) against a real `mastra dev` server with LibSQL storage and memory.
 * Only the model's HTTP endpoint is AIMock. The agent calls a `wait` tool that
 * blocks until the test releases it, so the run is reliably mid-flight.
 *
 * Backend evidence comes from the fixture's tool counters (/cor1519/state),
 * AIMock's request journal, and the persisted thread messages; UI evidence from
 * what the user sees (reply text, Send vs Cancel control).
 */
import { LLMock } from '@copilotkit/aimock';
import { expect, test, type Page, type Request } from '@playwright/test';

const SERVER = 'http://localhost:4111';
const REPLY = 'The wait is over.';
type ToolState = { started: number; aborted: number; finished: number };

let llm: LLMock;
test.beforeAll(async () => {
  llm = new LLMock({ port: 4319 });
  await llm.start();
  const isToolResult = (req: any) => req.messages?.at(-1)?.role === 'tool';
  llm.on({ endpoint: 'chat', predicate: (r: any) => !isToolResult(r) }, { toolCalls: [{ name: 'wait', arguments: '{}' }] });
  llm.on({ endpoint: 'chat', predicate: isToolResult }, { content: REPLY });
});
test.afterAll(async () => {
  await llm.stop();
});

async function toolState(): Promise<ToolState> {
  return (await fetch(`${SERVER}/cor1519/state`)).json();
}

async function threadMessages(agentId: string, threadId: string): Promise<Array<{ role: string; text: string }>> {
  const res = await fetch(
    `${SERVER}/api/memory/threads/${threadId}/messages?agentId=${agentId}&resourceId=${agentId}`,
  );
  const body = await res.json();
  return (body.messages ?? []).map((m: any) => ({
    role: m.role,
    text: JSON.stringify(m.content ?? '').includes(REPLY) ? REPLY : '',
  }));
}

function trackAgentRequests(page: Page) {
  const requests: Request[] = [];
  page.on('request', r => {
    if (r.url().includes('/api/agents/')) requests.push(r);
  });
  return {
    paths: () => requests.map(r => `${r.method()} ${new URL(r.url()).pathname}`),
    aborts: () => requests.filter(r => new URL(r.url()).pathname.endsWith('/threads/abort')),
  };
}

const cancelButton = (page: Page) => page.getByRole('button', { name: 'Cancel' });
const sendButton = (page: Page) => page.getByRole('button', { name: 'Send' });

async function startRun(page: Page, agentId: string) {
  await page.goto(`/agents/${agentId}/threads/new`);
  const composer = page.getByPlaceholder('Enter your message');
  await composer.fill('Start the job');
  await composer.press('Enter');
  await expect.poll(async () => (await toolState()).started, { timeout: 15_000 }).toBe(1);
  await expect(page).toHaveURL(/\/threads\/(?!new)[^/]+$/);
  const threadId = page.url().split('/').at(-1)!;
  await expect(cancelButton(page)).toBeVisible();
  return threadId;
}

for (const agentId of ['plain-agent', 'durable-agent']) {
  test.describe(`Studio chat Stop and reload on ${agentId}`, () => {
    test.beforeEach(async () => {
      await fetch(`${SERVER}/cor1519/reset`, { method: 'POST' });
      llm.clearRequests();
    });

    test.describe('when the user presses Cancel while the tool is running', () => {
      test('aborts the run on the server, never calls the model again, and leaves the chat idle', async ({ page }) => {
        const tracked = trackAgentRequests(page);
        const threadId = await startRun(page, agentId);

        await cancelButton(page).click();

        await expect.poll(toolState, { timeout: 10_000 }).toMatchObject({ started: 1, aborted: 1, finished: 0 });
        await expect(sendButton(page)).toBeVisible();
        expect(tracked.paths()).toContain(`POST /api/agents/${agentId}/send-message`);
        expect(tracked.paths()).toContain(`POST /api/agents/${agentId}/threads/subscribe`);
        expect(tracked.aborts().length).toBeGreaterThan(0);
        const abortBody = tracked.aborts()[0]!.postDataJSON();
        expect(abortBody).toMatchObject({ threadId, expectedRunId: expect.any(String) });
        await page.waitForTimeout(1_000);
        expect(llm.getRequests()).toHaveLength(1);
        await expect(page.getByText(REPLY)).toHaveCount(0);

        await page.reload();
        await expect(page.getByText('Start the job')).toBeVisible();
        await expect(page.getByText(REPLY)).toHaveCount(0);
        await expect(sendButton(page)).toBeVisible();
        expect((await threadMessages(agentId, threadId)).some(m => m.text === REPLY)).toBe(false);
      });
    });

    test.describe('when the page is reloaded while the run is in flight', () => {
      test('re-attaches to the live run and shows the reply when it finishes', async ({ page }) => {
        const threadId = await startRun(page, agentId);

        await page.reload();
        await expect(page.getByText('Start the job')).toBeVisible();
        await expect(cancelButton(page)).toBeVisible();

        await fetch(`${SERVER}/cor1519/release`, { method: 'POST' });

        await expect(page.getByText(REPLY)).toHaveCount(1, { timeout: 15_000 });
        await expect(sendButton(page)).toBeVisible();
        expect(await toolState()).toMatchObject({ started: 1, aborted: 0, finished: 1 });
        expect(llm.getRequests()).toHaveLength(2);
        expect((await threadMessages(agentId, threadId)).filter(m => m.text === REPLY)).toHaveLength(1);
      });
    });

    test.describe('when the page is reloaded and the user presses Cancel', () => {
      test('aborts the live run from the reloaded tab, and the next message still runs', async ({ page }) => {
        const tracked = trackAgentRequests(page);
        await startRun(page, agentId);

        await page.reload();
        await expect(cancelButton(page)).toBeVisible();
        await cancelButton(page).click();

        await expect.poll(toolState, { timeout: 10_000 }).toMatchObject({ started: 1, aborted: 1, finished: 0 });
        await expect(sendButton(page)).toBeVisible();
        expect(tracked.aborts().length).toBeGreaterThan(0);
        expect(llm.getRequests()).toHaveLength(1);

        await fetch(`${SERVER}/cor1519/reset`, { method: 'POST' });
        const composer = page.getByPlaceholder('Enter your message');
        await composer.fill('Run it again');
        await composer.press('Enter');
        await expect.poll(async () => (await toolState()).started, { timeout: 15_000 }).toBe(1);
        await fetch(`${SERVER}/cor1519/release`, { method: 'POST' });
        await expect(page.getByText(REPLY)).toHaveCount(1, { timeout: 15_000 });
        await expect(sendButton(page)).toBeVisible();
      });
    });
  });
}
