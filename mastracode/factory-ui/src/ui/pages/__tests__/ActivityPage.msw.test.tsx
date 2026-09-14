import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../e2e/ui/msw-server';
import { renderWithProviders, waitForMutationsIdle } from '../../../../e2e/ui/render';
import type { WorkItemStageEntry } from '../../domains/factory/services/workItems';
import { ActivityContent } from '../ActivityPage';

const FACTORY_ID = 'factory-1';

const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();

/** Halfway through the current local day, so a run near midnight never lands the row on yesterday. */
function earlierToday(): string {
  const midnight = new Date().setHours(0, 0, 0, 0);
  return new Date(midnight + (Date.now() - midnight) / 2).toISOString();
}

let nextId = 0;
function card(title: string, stageHistory: WorkItemStageEntry[]) {
  nextId += 1;
  return {
    id: `item-${nextId}`,
    orgId: 'org1',
    createdBy: 'u1',
    factoryProjectId: FACTORY_ID,
    parentWorkItemId: null,
    externalSource: null,
    title,
    stages: [stageHistory.at(-1)?.stage ?? 'intake'],
    stageHistory,
    sessions: { work: { sessionId: `session-${nextId}`, branch: 'b', threadId: 't', startedBy: 'u1' } },
    metadata: null,
    revision: 1,
    createdAt: stageHistory[0]?.enteredAt ?? hoursAgo(20),
    updatedAt: hoursAgo(1),
  };
}

function stubBoard(workItems: unknown[]) {
  server.use(
    http.get('*/web/factory/projects/:id/work-items', () => HttpResponse.json({ workItems, runningSessionIds: [] })),
  );
}

function stubAudit(events: unknown[], actors: Record<string, unknown> = {}) {
  server.use(http.get('*/web/factory/projects/:id/audit', () => HttpResponse.json({ events, actors })));
}

function renderActivity() {
  return renderWithProviders(
    <MemoryRouter>
      <ActivityContent factoryId={FACTORY_ID} />
    </MemoryRouter>,
  );
}

describe('Activity', () => {
  it('reads a stage move as a sentence, naming the hand that made it', async () => {
    stubBoard([card('Fix the flaky auth test', [{ stage: 'review', enteredAt: earlierToday(), by: 'agent:builder' }])]);
    const { client } = renderActivity();
    await waitForMutationsIdle(client);

    expect(await screen.findByText('Agent')).toBeInTheDocument();
    expect(screen.getByText('moved')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Fix the flaky auth test' })).toBeInTheDocument();
    expect(screen.getByText('Today')).toBeInTheDocument();
  });

  it('folds one hand walking a card through several stages into a single sentence', async () => {
    stubBoard([
      card('Bump vite to 7', [
        { stage: 'triage', enteredAt: hoursAgo(4), by: 'agent:builder' },
        { stage: 'execute', enteredAt: hoursAgo(3), by: 'agent:builder' },
        { stage: 'done', enteredAt: hoursAgo(2), by: 'agent:builder' },
      ]),
    ]);
    renderActivity();

    expect(await screen.findAllByText('Bump vite to 7')).toHaveLength(1);
    expect(screen.getByText('moved')).toBeInTheDocument();
  });

  it('carries the audit trail beside the moves — a push is not a stage change', async () => {
    stubBoard([]);
    stubAudit([
      {
        id: 'event-1',
        actorId: 'u1',
        actorType: 'human',
        action: 'factory.agent.push',
        targets: [],
        metadata: { branch: 'fix/thing' },
        occurredAt: hoursAgo(1),
      },
    ]);
    renderActivity();

    expect(await screen.findByText('pushed to')).toBeInTheDocument();
    expect(screen.getByText('fix/thing')).toBeInTheDocument();
  });

  it('says nothing has happened rather than drawing an empty rail', async () => {
    stubBoard([]);
    renderActivity();

    expect(await screen.findByText('Nothing has happened yet.')).toBeInTheDocument();
  });
});
