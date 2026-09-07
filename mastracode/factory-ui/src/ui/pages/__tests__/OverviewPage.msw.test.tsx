import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../e2e/ui/msw-server';
import { renderWithProviders, waitForMutationsIdle } from '../../../../e2e/ui/render';
import type { WorkItemStageEntry } from '../../domains/factory/services/workItems';
import { OverviewContent } from '../OverviewPage';

const FACTORY_ID = 'factory-1';
const REPOSITORY = { projectRepositoryId: 'repository-1', slug: 'acme/app' };

const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();

let nextId = 0;
/** The board's wire shape: the funnel counts a card only once the Factory has run on it. */
function card(stageHistory: WorkItemStageEntry[], overrides: Record<string, unknown> = {}) {
  nextId += 1;
  const sessionId = `session-${nextId}`;
  return {
    id: `item-${nextId}`,
    orgId: 'org1',
    createdBy: 'u1',
    factoryProjectId: FACTORY_ID,
    parentWorkItemId: null,
    externalSource: null,
    title: `Item ${nextId}`,
    stages: [stageHistory.at(-1)?.stage ?? 'intake'],
    stageHistory,
    sessions: { work: { sessionId, branch: 'b', threadId: 't', startedBy: 'u1' } },
    metadata: null,
    revision: 1,
    createdAt: stageHistory[0]?.enteredAt ?? hoursAgo(20),
    updatedAt: hoursAgo(1),
    ...overrides,
  };
}

function stubBoard(workItems: unknown[], runningSessionIds: string[] = [], findings: unknown[] = []) {
  const counts = {
    'decision-failed': 0,
    'decision-stuck': 0,
    'start-stalled': 0,
    'seat-orphaned': 0,
    'seat-missing': 0,
    'proposal-waiting': 0,
    'held-waiting': 0,
    'label-drift': 0,
  };
  server.use(
    http.get('*/web/factory/projects/:id/work-items', () => HttpResponse.json({ workItems, runningSessionIds })),
    http.get('*/web/factory/projects/:id/supervisor/health', () =>
      HttpResponse.json({ checkedAt: new Date().toISOString(), findings, counts }),
    ),
  );
}

function renderOverview(repository?: typeof REPOSITORY) {
  return renderWithProviders(
    <MemoryRouter>
      <OverviewContent factoryProjectId={FACTORY_ID} repository={repository} />
    </MemoryRouter>,
  );
}

describe('Overview', () => {
  it('funnels the window cohort by the furthest stage each card reached', async () => {
    stubBoard([
      card([
        { stage: 'intake', enteredAt: hoursAgo(30), by: 'u1' },
        { stage: 'execute', enteredAt: hoursAgo(20), by: 'agent:builder' },
        { stage: 'done', enteredAt: hoursAgo(4), by: 'agent:builder' },
      ]),
      card([
        { stage: 'intake', enteredAt: hoursAgo(28), by: 'u1' },
        { stage: 'done', enteredAt: hoursAgo(3), by: 'agent:builder' },
      ]),
      card([{ stage: 'triage', enteredAt: hoursAgo(26), by: 'u1' }]),
    ]);
    const { client } = renderOverview(REPOSITORY);
    await waitForMutationsIdle(client);

    expect(
      await screen.findByRole('img', { name: '3 items entered, shedding 1 on the way to 2 at Done.' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'acme/app' })).toHaveAttribute(
      'href',
      'https://github.com/acme/app/commits',
    );
  });

  it('leaves out work the Factory never ran — a synced upstream card is not its cohort', async () => {
    stubBoard([
      card(
        [
          { stage: 'intake', enteredAt: hoursAgo(30), by: 'github:someone' },
          { stage: 'done', enteredAt: hoursAgo(4), by: 'github:someone' },
        ],
        { sessions: {} },
      ),
    ]);
    renderOverview();

    expect(await screen.findByText('Nothing new in this window')).toBeInTheDocument();
  });

  it('counts a card with a live session as running, not as stalled', async () => {
    stubBoard(
      [
        card([{ stage: 'execute', enteredAt: hoursAgo(9), by: 'u1' }], { title: 'Nobody is on this' }),
        card([{ stage: 'execute', enteredAt: hoursAgo(9), by: 'u1' }], {
          title: 'A session is on this',
          sessions: { work: { sessionId: 'live', branch: 'b', threadId: 't', startedBy: 'u1' } },
        }),
      ],
      ['live'],
    );
    renderOverview();

    expect(await screen.findAllByText('Nobody is on this')).not.toHaveLength(0);
    expect(screen.getByText('1 waiting')).toBeInTheDocument();
    expect(screen.getByText('1 running · 2 in the pipeline')).toBeInTheDocument();
  });

  it('shows the supervisor finding count beside work needing attention', async () => {
    stubBoard([], [], [{ id: 'finding-1' }, { id: 'finding-2' }]);
    const { client } = renderOverview();
    await waitForMutationsIdle(client);

    expect(await screen.findByRole('link', { name: '2 supervisor findings' })).toHaveAttribute(
      'href',
      `/factories/${FACTORY_ID}/supervisor`,
    );
  });

  it('says a Factory has no repository rather than waiting on commits that cannot arrive', async () => {
    stubBoard([]);
    renderOverview();

    expect(await screen.findByText('No repository linked yet')).toBeInTheDocument();
    expect(screen.getByText('Nothing new in this window')).toBeInTheDocument();
  });
});
