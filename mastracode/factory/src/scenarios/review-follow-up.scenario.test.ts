/**
 * Scenario: a reviewer asks for changes on a pull request Factory opened, and a person in a user
 * session asks their agent to chase it up. The agent finds the cards still waiting on a response
 * and messages the session that wrote the code, which picks the message up and runs.
 */
import { randomUUID } from 'node:crypto';

import { afterEach, describe, expect, it } from 'vitest';

import { startFactoryScenario, toolCall } from './harness.js';
import type { FactoryScenario, ModelScript } from './harness.js';

const HEAD = 'a'.repeat(40);
const ASK = 'Which of my cards are still waiting on review changes? Nudge their builders.';
const NUDGE = 'Review asked for changes on your pull request; please address them and push.';

let s: FactoryScenario | undefined;
afterEach(async () => {
  await s?.close();
  s = undefined;
});

/** The review run records "request changes" on the head it read, once. */
const requestChanges: ModelScript = (() => {
  let done = false;
  return request => {
    if (done || request.role !== 'review') return undefined;
    done = true;
    return toolCall('factory_record_review_verdict', {
      verdict: 'request changes',
      reviewedHeadSha: HEAD,
      findings: 'The retry loop never backs off.',
    });
  };
})();

/** The user session's agent: list cards awaiting a response, then message each one's builder. */
const chaseUp: ModelScript = request => {
  if (!request.text.includes(ASK)) return undefined;
  if (!request.text.includes('awaitingResponse'))
    return toolCall('factory_list_work_items', { review: 'awaiting-response' });
  if (request.text.includes('notificationId')) return undefined;
  const workSessionId = request.text.match(/workSessionId\\*":\\*"([^"\\]+)/)?.[1];
  expect(workSessionId, 'the listing names the session that wrote the code').toBeDefined();
  return toolCall('factory_signal_session', { sessionId: workSessionId, message: NUDGE });
};

describe('review follow-up', () => {
  it('finds the card a review sent back and messages the session that built it', async () => {
    s = await startFactoryScenario();
    s.setModel(requestChanges, chaseUp);
    const project = await s.createProject('Payments');
    const repo = await s.connectGithubRepository(project.id, 'acme/payments');
    const repository = { id: Number(repo.externalId), full_name: repo.slug };

    // An issue arrives and someone starts the work.
    expect(
      (
        await s.githubWebhook('issues', {
          action: 'opened',
          repository,
          issue: {
            id: 501,
            number: 5,
            title: 'Payments retry storm',
            html_url: `https://github.com/${repo.slug}/issues/5`,
            state: 'open',
            created_at: '2026-10-18T00:00:00Z',
            user: { login: 'ada' },
            labels: [],
            assignees: [],
          },
          sender: { login: 'ada' },
        })
      ).status,
    ).toBe(202);
    const work = await waitForTitle(s, project.id, 'Payments retry storm');
    await move(s, project.id, work, 'execute');
    await expect.poll(() => s!.modelRequests.some(r => r.role === 'work'), { timeout: 15_000 }).toBe(true);
    const building = await s.waitForCard(work.id, { stages: ['execute'] });
    const workSessionId = building.sessions.work?.sessionId;
    expect(workSessionId).toBeDefined();
    const branch = building.sessions.work!.branch;

    // Factory opens a pull request from the work session's branch, and it goes to review.
    expect(
      (
        await s.githubWebhook('pull_request', {
          action: 'opened',
          repository,
          sender: { login: 'factory-scenario[bot]' },
          pull_request: {
            number: 17,
            title: 'Back off payment retries',
            html_url: `https://github.com/${repo.slug}/pull/17`,
            created_at: '2026-10-18T01:00:00Z',
            state: 'open',
            merged: false,
            user: { login: 'factory-scenario[bot]' },
            head: { ref: branch, sha: HEAD },
            base: { ref: 'main' },
          },
        })
      ).status,
    ).toBe(202);
    const reviewCard = await waitForTitle(s, project.id, 'Back off payment retries');
    expect(reviewCard).toMatchObject({ board: 'review', parentWorkItemId: work.id });
    await move(s, project.id, reviewCard, 'review');

    // The review asks for changes, and the verdict lands on the card that wrote the code.
    await s.waitForCard(work.id, {
      metadata: expect.objectContaining({ reviewVerdict: 'request changes', reviewedHeadSha: HEAD }),
    });

    // Someone asks their own session to chase it up.
    const workRunsBefore = s.modelRequests.filter(request => request.role === 'work').length;
    const user = await s.openUserSession(repo.projectRepositoryId);
    await user.send(ASK);

    // The builder's session receives the nudge and runs on it.
    await expect
      .poll(() => s!.modelRequests.slice(0).some(r => r.role === 'work' && r.text.includes(NUDGE)), {
        timeout: 15_000,
      })
      .toBe(true);
    expect(s.modelRequests.filter(request => request.role === 'work').length).toBeGreaterThan(workRunsBefore);
    // Only the card review sent back was listed, not the Review card itself.
    const listing = s.modelRequests.find(r => r.text.includes(ASK) && r.text.includes('awaitingResponse'))!.text;
    expect(listing).toContain(work.id);
    expect(listing).not.toContain(reviewCard.id);
  }, 60_000);
});

async function waitForTitle(scenario: FactoryScenario, factoryProjectId: string, title: string) {
  let found: Awaited<ReturnType<FactoryScenario['workItems']['list']>>[number] | undefined;
  await expect
    .poll(
      async () => {
        const items = await scenario.workItems.list({ orgId: 'scenario-org', factoryProjectId });
        found = items.find(item => item.title.includes(title));
        return found !== undefined;
      },
      { timeout: 15_000 },
    )
    .toBe(true);
  return found!;
}

async function move(
  scenario: FactoryScenario,
  factoryProjectId: string,
  card: { id: string; revision: number; board: string | null },
  stage: string,
) {
  const { result } = await scenario.json(
    'POST',
    `/web/factory/projects/${factoryProjectId}/work-items/${card.id}/transition`,
    {
      board: card.board,
      stage,
      expectedRevision: card.revision,
      requestId: randomUUID(),
      cause: `move-to-${stage}`,
    },
  );
  expect(result).toMatchObject({ status: 'accepted' });
}
