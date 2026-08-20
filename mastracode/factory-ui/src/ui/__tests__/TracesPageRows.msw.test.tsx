import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../e2e/ui/render';
import type { WorkItem } from '../domains/factory/services/workItems';
import { createAppRoutes } from '../router';

const FACTORY_ID = 'fp-1';
const HOUR = 3_600_000;

const hoursAgo = (hours: number) => new Date(Date.now() - hours * HOUR).toISOString();

function card(id: string, title: string, stages: string[], stageHistory: WorkItem['stageHistory']): WorkItem {
  return {
    id,
    orgId: 'org-1',
    createdBy: 'user-1',
    githubProjectId: FACTORY_ID,
    source: 'github-issue',
    sourceKey: `mastra-ai/mastra:${id}`,
    parentWorkItemId: null,
    title,
    url: null,
    stages,
    stageHistory,
    sessions: {},
    metadata: {},
    revision: 1,
    createdAt: hoursAgo(9),
    updatedAt: hoursAgo(1),
  };
}

/** One card sitting in review for 6h, one that never left intake. */
const WORK_ITEMS: WorkItem[] = [
  card(
    'wi-review',
    'Reviewer owes this an answer',
    ['review'],
    [
      { stage: 'triage', enteredAt: hoursAgo(8), exitedAt: hoursAgo(7), by: 'agent:1', exitedBy: 'agent:1' },
      { stage: 'review', enteredAt: hoursAgo(6), by: 'agent:1' },
    ],
  ),
  card(
    'wi-intake',
    'Synced but never started',
    ['intake'],
    [{ stage: 'intake', enteredAt: hoursAgo(5), by: 'github' }],
  ),
];

function stubBoard(workItems: WorkItem[]) {
  server.use(
    http.get(`${TEST_BASE_URL}/auth/me`, () =>
      HttpResponse.json({ authenticated: true, authEnabled: true, user: { userId: 'user-1' } }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
      HttpResponse.json({ projects: [{ id: FACTORY_ID, name: 'Acme Factory' }] }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items`, () => HttpResponse.json({ workItems })),
  );
}

function renderTraces() {
  const router = createMemoryRouter(createAppRoutes(), { initialEntries: [`/factories/${FACTORY_ID}/traces`] });
  return renderWithProviders(<RouterProvider router={router} />);
}

describe('Traces page', () => {
  it('draws a row per card that moved, and leaves out the ones that never did', async () => {
    stubBoard(WORK_ITEMS);
    renderTraces();

    // An empty row would read as a card that stalled — the opposite of a card
    // the factory never picked up, which the Queue page counts instead.
    expect(await screen.findByLabelText('Reviewer owes this an answer — Review since 6h')).toBeInTheDocument();
    expect(screen.queryByLabelText(/Synced but never started/)).not.toBeInTheDocument();
  });

  it('counts the window in the header, so the rows are read against a number', async () => {
    stubBoard(WORK_ITEMS);
    renderTraces();

    expect(await screen.findByText('1 card moved in the last 24 hours')).toBeInTheDocument();
  });

  // The row draws how long, not how long ago it started or how often it came
  // back — hovering is where a trace turns into a sentence.
  it('answers a hovered row with the history the bar cannot draw', async () => {
    stubBoard(WORK_ITEMS);
    renderTraces();

    await userEvent.hover(await screen.findByLabelText(/Reviewer owes this an answer/));

    expect(screen.getByText(/In the factory 9h/)).toBeInTheDocument();
  });

  it('given a window nothing moved in, then it says so instead of drawing an empty grid', async () => {
    stubBoard([WORK_ITEMS[1]!]);
    renderTraces();

    expect(await screen.findByText('No card moved in this window.')).toBeInTheDocument();
  });
});
