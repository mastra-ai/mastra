import type { WorkItemRow } from '@mastra/factory/storage/domains/work-items/base';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '../../../e2e/ui/render';
import { queryKeys } from '../../api/keys';
import { AGENT_CONTROLLER_ID } from '../domains/chat/services/constants';
import type { FactoryDecisionPage, FactoryDecisionSummary } from '../domains/factory/services/decisions';
import type { GithubPullRequestDetail } from '../domains/factory/services/factory';
import type { FactoryTransitionResult } from '../domains/factory/services/workItems';
import { createAppRoutes } from '../router';
import { reviewCandidate, reviewDecision, reviewItem } from './fixtures/reviewCard';

const FACTORY_ID = reviewItem.factoryProjectId;
const projectUrl = `${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}`;

function deferred() {
  let resolve = () => {};
  const promise = new Promise<void>(done => {
    resolve = done;
  });
  return { promise, resolve };
}

function stubReviewBoard(candidate = false, decision?: FactoryDecisionSummary) {
  const items: WorkItemRow[] = candidate ? [] : [{ ...reviewItem, stages: decision ? ['review'] : ['intake'] }];
  const decisions: FactoryDecisionSummary[] = decision ? [decision] : [];
  const runningSessionIds: string[] = [];
  const data = { items, decisions, runningSessionIds, transitionCommitted: false, decisionRefreshStarted: false };
  const transitionGate = deferred();
  const decisionsGate = deferred();
  const retryGate = deferred();
  const transitions: unknown[] = [];
  const retries: string[] = [];

  server.use(
    http.get(`${TEST_BASE_URL}/auth/me`, () =>
      HttpResponse.json({ authenticated: true, authEnabled: true, user: { userId: 'user-1' } }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
      HttpResponse.json({ projects: [{ id: FACTORY_ID, name: 'Acme Factory' }] }),
    ),
    http.get(`${projectUrl}/source-control-connections`, () =>
      HttpResponse.json({
        connections: [
          {
            id: 'conn-1',
            installationId: 'inst-1',
            repositories: [
              {
                id: 'repo-1',
                branch: 'main',
                sandboxWorkdir: '/repo',
                repository: { slug: 'acme/app', defaultBranch: 'main' },
              },
            ],
          },
        ],
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/intake/config`, () =>
      HttpResponse.json({
        config: { github: { enabled: true, sourceIds: ['acme/app'] }, linear: { enabled: false, sourceIds: null } },
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/linear/status`, () =>
      HttpResponse.json({ enabled: false, connected: false, workspace: null }),
    ),
    http.get(`${TEST_BASE_URL}/web/github/projects/repo-1/prs`, () =>
      HttpResponse.json({ pullRequests: candidate ? [reviewCandidate] : [], nextPage: null }),
    ),
    http.get(`${TEST_BASE_URL}/web/github/projects/repo-1/prs/42`, () =>
      HttpResponse.json({
        ...reviewCandidate,
        description: 'Add rate limits to the API.',
      } satisfies GithubPullRequestDetail),
    ),
    http.get('*/api/agent-controller/:controllerId/active-runs', () =>
      HttpResponse.json({
        runs: data.runningSessionIds.map(resourceId => ({ runId: 'run-42', resourceId, threadId: 'thread-42' })),
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/source-control/projects/repo-1/sessions`, () => HttpResponse.json({ sessions: [] })),
    http.get(`${projectUrl}/work-items`, () =>
      HttpResponse.json({ workItems: data.items, runningSessionIds: data.runningSessionIds }),
    ),
    http.post(`${projectUrl}/work-items`, () => {
      data.items = [{ ...reviewItem }];
      return HttpResponse.json({ workItem: data.items[0] });
    }),
    http.get(`${projectUrl}/decisions`, async () => {
      if (data.transitionCommitted) {
        data.decisionRefreshStarted = true;
        await decisionsGate.promise;
      }
      return HttpResponse.json({ decisions: data.decisions } satisfies FactoryDecisionPage);
    }),
    http.post(`${projectUrl}/work-items/${reviewItem.id}/transition`, async ({ request }) => {
      transitions.push(await request.json());
      await transitionGate.promise;
      data.items = data.items.map(item => ({ ...item, stages: ['review'], revision: 2 }));
      data.decisions = [{ ...reviewDecision }];
      data.transitionCommitted = true;
      const result: FactoryTransitionResult = {
        status: 'accepted',
        transitionId: 'transition-1',
        itemId: reviewItem.id,
        revision: 2,
        stage: 'review',
        decisions: [],
      };
      return HttpResponse.json({ result });
    }),
    http.post(`${projectUrl}/decisions/${reviewDecision.id}/retry`, async () => {
      retries.push(reviewDecision.id);
      await retryGate.promise;
      const retried: FactoryDecisionSummary = { ...reviewDecision, status: 'retry', attempts: 1, lastError: 'Timeout' };
      data.decisions = [retried];
      return HttpResponse.json({ decision: retried });
    }),
  );
  return { data, transitions, retries, transitionGate, decisionsGate, retryGate };
}

function renderReviewBoard() {
  const router = createMemoryRouter(createAppRoutes(), { initialEntries: [`/factories/${FACTORY_ID}/review`] });
  return renderWithProviders(<RouterProvider router={router} />);
}

describe('Review card action lifecycle', () => {
  it.each([true, false])('keeps Review busy from Intake through kickoff (candidate: %s)', async candidate => {
    const { data, transitions, transitionGate, decisionsGate } = stubReviewBoard(candidate);
    const user = userEvent.setup();
    const { client } = renderReviewBoard();
    await user.click(await screen.findByRole('button', { name: 'Review' }));

    const reviewing = screen.getByRole('region', { name: 'Reviewing' });
    await waitFor(() => expect(within(reviewing).getByRole('button', { name: 'Moving…' })).toBeDisabled());
    expect(within(reviewing).queryByRole('button', { name: 'Review' })).toBeNull();

    transitionGate.resolve();
    await waitFor(() => expect(data.decisionRefreshStarted).toBe(true));
    // The transition has committed, but its decisions query is still in flight.
    expect(within(reviewing).getByRole('button', { name: 'Moving…' })).toBeDisabled();
    decisionsGate.resolve();
    await waitForMutationsIdle(client);
    expect(within(reviewing).getByText('Starting an automated run…')).toBeVisible();
    expect(within(reviewing).getByRole('button', { name: 'Starting…' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: `Actions for ${reviewItem.title}` }));
    const menuReview = await screen.findByRole('menuitem', { name: 'Review' });
    expect(menuReview).toHaveAttribute('aria-disabled', 'true');
    await user.click(menuReview);
    await user.keyboard('{Escape}');

    await user.click(screen.getByRole('button', { name: `Details for ${reviewItem.title}` }));
    const panel = await screen.findByRole('dialog', { name: reviewItem.title });
    expect(within(panel).getByRole('button', { name: 'Starting…' })).toBeDisabled();

    data.items = data.items.map(item => ({
      ...item,
      sessions: {
        review: { sessionId: 'session-42', threadId: 'thread-42', branch: 'rate-limiting', startedBy: 'user-1' },
      },
    }));
    data.runningSessionIds = ['session-42'];
    data.decisions = [{ ...reviewDecision, status: 'leased' }];
    await Promise.all([
      client.invalidateQueries({ queryKey: queryKeys.workItems(FACTORY_ID) }),
      client.invalidateQueries({ queryKey: queryKeys.factoryDecisionsRoot(FACTORY_ID) }),
      client.invalidateQueries({ queryKey: queryKeys.agentControllerActivity(AGENT_CONTROLLER_ID, TEST_BASE_URL) }),
    ]);
    await waitFor(() =>
      expect(within(panel).getByRole('link', { name: 'Open session' })).toHaveAttribute(
        'href',
        `/factories/${FACTORY_ID}/workspaces/session-42/threads/thread-42`,
      ),
    );
    expect(within(panel).queryByRole('button', { name: 'Review' })).toBeNull();
    await waitFor(() => expect(within(panel).queryByText('Starting an automated run…')).toBeNull());
    expect(transitions).toEqual([expect.objectContaining({ board: 'review', stage: 'review', cause: 'card_action' })]);
  });

  it('keeps automatic and manual retries busy, and offers Retry after a final failure', async () => {
    const { data, retries, retryGate } = stubReviewBoard(false, {
      ...reviewDecision,
      status: 'retry',
      attempts: 1,
      lastError: 'Timeout',
    });
    const user = userEvent.setup();
    const { client } = renderReviewBoard();
    await waitForMutationsIdle(client);
    const card = await screen.findByTestId('work-item-card');
    expect(within(card).getByRole('button', { name: 'Retrying…' })).toBeDisabled();
    expect(within(card).getByText('Automated run could not start — retrying…')).toBeVisible();
    expect(within(card).queryByRole('button', { name: 'Review' })).toBeNull();

    data.decisions = [{ ...reviewDecision, status: 'failed', canRetry: true, attempts: 5, lastError: 'Timeout' }];
    await client.invalidateQueries({ queryKey: queryKeys.factoryDecisionsRoot(FACTORY_ID) });
    await user.click(await within(card).findByRole('button', { name: 'Retry' }));
    expect(within(card).getByRole('button', { name: 'Retrying…' })).toBeDisabled();
    expect(within(card).queryByRole('button', { name: 'Review' })).toBeNull();
    retryGate.resolve();
    await waitForMutationsIdle(client);
    expect(within(card).getByRole('button', { name: 'Retrying…' })).toBeDisabled();
    expect(retries).toEqual([reviewDecision.id]);
  });
});
