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
    role: 'work',
    skillName: 'factory-plan',
    queuedSince: `2026-08-05T00:0${position}:00.000Z`,
    workItem,
  };
}

const runQueue: RunQueueResponse = {
  slots: { scope: 'server', inUse: 2, cap: 2 },
  running: 2,
  claimed: [],
  queuedCount: 3,
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
