import type { RunQueueResponse } from '@mastra/factory/routes/contracts';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../e2e/ui/render';
import type { FactoryDecisionPage, FactoryDecisionSummary } from '../domains/factory/services/decisions';
import { createAppRoutes } from '../router';
import { FACTORY_ID, stubWorkBoard } from './workBoardStubs';

const projectUrl = `${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}`;

function waitingRun(decisionId: string, workItemId: string): FactoryDecisionSummary {
  return {
    id: decisionId,
    evaluationId: `evaluation-${decisionId}`,
    workItemId,
    type: 'invokeSkill',
    role: 'work',
    source: null,
    status: 'pending',
    attempts: 0,
    failureOccurrence: 0,
    failureCode: null,
    canRetry: false,
    lastError: null,
    createdAt: '2026-08-05T00:00:00.000Z',
    updatedAt: '2026-08-05T00:00:00.000Z',
    completedAt: null,
  };
}

type QueueEntry = RunQueueResponse['queued'][number];

function queued(position: number, decisionId: string, workItem: QueueEntry['workItem']): QueueEntry {
  return {
    decisionId,
    state: 'waiting',
    position,
    type: 'invokeSkill',
    lane: 'automated',
    role: 'work',
    skillName: 'factory-plan',
    queuedSince: `2026-08-05T00:0${position}:00.000Z`,
    workItem,
  };
}

const runQueue: RunQueueResponse = {
  slots: { scope: 'server', inUse: 2, cap: 2, interactive: { inUse: 0, cap: 2 } },
  running: 2,
  claimed: [],
  queuedCount: 3,
  queuedByLane: { automated: 3, interactive: 0 },
  queued: [
    queued(1, 'decision-a', { id: 'other-a', key: 'ACME-1', title: 'Fix login', board: 'work', phase: 'execute' }),
    queued(2, 'decision-b', { id: 'other-b', key: null, title: 'Add rate limits', board: 'work', phase: 'execute' }),
    queued(3, 'decision-recent', {
      id: 'recent-card',
      key: null,
      title: 'Moved recently',
      board: 'work',
      phase: 'triage',
    }),
  ],
};

function renderBoard() {
  const router = createMemoryRouter(createAppRoutes(), { initialEntries: [`/factories/${FACTORY_ID}/work`] });
  renderWithProviders(<RouterProvider router={router} />);
  return router;
}

describe('Board run queue', () => {
  it('shows no queue indicator while no run waits for a slot', async () => {
    stubWorkBoard();
    renderBoard();
    await within(await screen.findByTestId('board-column-triage')).findByText('Moved recently');
    expect(screen.queryByRole('button', { name: /queued/ })).not.toBeInTheDocument();
  });

  it('counts the waiting runs and lists them oldest first, each linking to its card', async () => {
    stubWorkBoard();
    server.use(http.get(`${projectUrl}/run-queue`, () => HttpResponse.json(runQueue)));
    const user = userEvent.setup();
    const router = renderBoard();

    const indicator = await screen.findByRole('button', { name: '3 queued, 2 running on this server' });
    await user.click(indicator);

    const rows = await screen.findAllByRole('menuitem');
    expect(rows.map(row => row.textContent)).toEqual([
      expect.stringContaining('Fix login'),
      expect.stringContaining('Add rate limits'),
      expect.stringContaining('Moved recently'),
    ]);
    expect(rows[0]).toHaveTextContent('#1');
    expect(rows[0]).toHaveTextContent('ACME-1');
    expect(rows[0]).toHaveTextContent('factory-plan');
    expect(rows[0]).toHaveAttribute('href', `/factories/${FACTORY_ID}/work?item=other-a`);

    await user.click(rows[2]);
    expect(router.state.location.search).toBe('?item=recent-card');
  });

  it("lists a person's reply waiting for a slot apart from the automated runs, with each lane's slots", async () => {
    stubWorkBoard();
    const reply: QueueEntry = {
      ...queued(1, 'decision-reply', {
        id: 'other-b',
        key: 'ACME-2',
        title: 'Add rate limits',
        board: 'work',
        phase: 'review',
      }),
      type: 'sendMessage',
      lane: 'interactive',
      skillName: null,
    };
    server.use(
      http.get(`${projectUrl}/run-queue`, () =>
        HttpResponse.json({
          ...runQueue,
          slots: { scope: 'server', inUse: 2, cap: 2, interactive: { inUse: 2, cap: 2 } },
          queuedCount: 2,
          queuedByLane: { automated: 1, interactive: 1 },
          queued: [runQueue.queued[0], reply],
        } satisfies RunQueueResponse),
      ),
    );
    const user = userEvent.setup();
    renderBoard();

    await user.click(await screen.findByRole('button', { name: '2 queued, 2 running on this server' }));

    const menu = await screen.findByRole('menu');
    expect(menu.textContent).toMatch(
      /Replies waiting.*Add rate limits.*Waiting for a run slot, oldest first.*Fix login/,
    );
    const [replyRow] = await screen.findAllByRole('menuitem');
    expect(replyRow).toHaveTextContent('#1');
    expect(replyRow).toHaveTextContent('Reply from a person');
    expect(menu).toHaveTextContent('2 of 2 run slots in use on this server');
    expect(menu).toHaveTextContent('2 of 2 reply slots in use on this server');
  });

  it('labels a card waiting for a slot with its place in the queue', async () => {
    stubWorkBoard();
    server.use(
      http.get(`${projectUrl}/run-queue`, () => HttpResponse.json(runQueue)),
      http.get(`${projectUrl}/decisions`, () =>
        HttpResponse.json({
          decisions: [waitingRun('decision-recent', 'recent-card')],
        } satisfies FactoryDecisionPage),
      ),
    );
    renderBoard();

    const card = await within(await screen.findByTestId('board-column-triage')).findByRole('article', {
      name: 'Moved recently',
    });
    expect(await within(card).findByText('Queued (#3)')).toBeInTheDocument();
    expect(within(card).queryByText('Starting an automated run…')).not.toBeInTheDocument();
  });

  it('labels a waiting card from the run queue even when its run is past the board decision page', async () => {
    stubWorkBoard();
    server.use(http.get(`${projectUrl}/run-queue`, () => HttpResponse.json(runQueue)));
    renderBoard();

    const card = await within(await screen.findByTestId('board-column-triage')).findByRole('article', {
      name: 'Moved recently',
    });
    expect(await within(card).findByText('Queued (#3)')).toBeInTheDocument();
  });
});
