import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../e2e/ui/render';
import type { FactoryMetrics } from '../domains/factory/services/metrics';
import { EMPTY_METRICS } from './factoryMetrics';
import type { WorkItem } from '../domains/factory/services/workItems';
import { createAppRoutes } from '../router';

const FACTORY_ID = 'fp-1';
const HOUR = 3_600_000;

const hoursAgo = (hours: number) => new Date(Date.now() - hours * HOUR).toISOString();

function card(id: string, title: string, stage: string, heldForHours: number): WorkItem {
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
    stages: [stage],
    stageHistory: [{ stage, enteredAt: hoursAgo(heldForHours), by: 'agent:1' }],
    sessions: {
      [id]: { sessionId: `sess-${id}`, branch: `factory/${id}`, threadId: `thread-${id}`, startedBy: 'agent:1' },
    },
    metadata: {},
    revision: 1,
    createdAt: hoursAgo(heldForHours),
    updatedAt: hoursAgo(heldForHours),
  };
}

/** Two cards past the first age threshold, one still inside it. */
const WORK_ITEMS: WorkItem[] = [
  card('wi-review', 'Reviewer owes this an answer', 'review', 30),
  card('wi-stuck', 'Nobody ever took this', 'execute', 120),
  card('wi-fresh', 'Landed an hour ago', 'execute', 1),
];

const METRICS: FactoryMetrics = {
  ...EMPTY_METRICS,
  intake: { arrived: 20, pickedUp: 8, waiting: 12 },
};

function stubQueue(workItems: WorkItem[]) {
  server.use(
    http.get(`${TEST_BASE_URL}/auth/me`, () =>
      HttpResponse.json({ authenticated: true, authEnabled: true, user: { userId: 'user-1' } }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
      HttpResponse.json({ projects: [{ id: FACTORY_ID, name: 'Acme Factory' }] }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/metrics`, () =>
      HttpResponse.json({ metrics: METRICS }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items`, () => HttpResponse.json({ workItems })),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/health/thresholds`, () =>
      HttpResponse.json({ thresholdsSeconds: [14400, 86400, 259200] }),
    ),
  );
}

function renderOverview() {
  const router = createMemoryRouter(createAppRoutes(), { initialEntries: [`/factories/${FACTORY_ID}/overview`] });
  return renderWithProviders(<RouterProvider router={router} />);
}

describe('Overview attention', () => {
  it('leads with how many cards a person owes an answer, and slices them by why', async () => {
    stubQueue(WORK_ITEMS);
    renderOverview();

    expect(await screen.findByText('Reviewer owes this an answer')).toBeInTheDocument();

    // The card still inside its first threshold is moving on its own: it is
    // neither counted nor listed, so the count matches what the list shows.
    const heading = screen.getByRole('heading', { level: 2, name: /waiting on a person/ });
    expect(within(heading).getByText('2')).toBeInTheDocument();
    expect(heading).toHaveTextContent('oldest 5d');
    expect(screen.queryByText('Landed an hour ago')).not.toBeInTheDocument();

    // The sidebar carries the same count, so the signal reaches a page nobody is on.
    expect(screen.getByRole('button', { name: /^Needs you/ })).toHaveTextContent('2');

    await userEvent.click(screen.getByRole('button', { name: 'Needs review 1' }));

    expect(screen.getByText('Reviewer owes this an answer')).toBeInTheDocument();
    expect(screen.queryByText('Nobody ever took this')).not.toBeInTheDocument();
  });

  it('given a quiet board, then the sidebar carries no count to chase', async () => {
    stubQueue([WORK_ITEMS[2]!]);
    renderOverview();

    expect(await screen.findByText(/Nothing is waiting on a person/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Needs you/ })).toHaveTextContent(/^Needs you$/);
  });

  // The list belongs to the Overview; the sidebar button is how it reaches the
  // pages people actually sit on.
  it('hands the same list to whoever opens it from the sidebar', async () => {
    stubQueue(WORK_ITEMS);
    renderOverview();
    await screen.findByText('Reviewer owes this an answer');

    await userEvent.click(screen.getByRole('button', { name: /^Needs you/ }));

    const popover = await screen.findByRole('dialog');
    expect(within(popover).getByText('Reviewer owes this an answer')).toBeInTheDocument();
    expect(within(popover).getByText('Nobody ever took this')).toBeInTheDocument();
  });
});
