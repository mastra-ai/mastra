import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { attentionKindSummaries, itemsOfRequestedKinds } from '../../../../../../../e2e/ui/attention';
import { server } from '../../../../../../../e2e/ui/msw-server';
import {
  closePropertiesMenus,
  openPropertiesMenu,
  pickPropertyOption,
} from '../../../../../../../e2e/ui/properties-menu';
import { renderWithProviders, waitForMutationsIdle } from '../../../../../../../e2e/ui/render';
import type { FactoryActivityAttentionItem, FactoryAutomationFailedAttentionItem } from '../../../services/attention';
import type { WorkItemStageEntry } from '../../../services/workItems';
import { ActivityTimeline } from '../timeline/ActivityTimeline';

const FACTORY_ID = 'factory-1';

/**
 * A moment earlier in the current local day, `hours` back on a day squeezed into the time elapsed since midnight.
 * More hours back is always earlier, and nothing lands on yesterday, so a run near midnight keeps every row on one day.
 */
function earlierToday(hours = 12): string {
  const midnight = new Date().setHours(0, 0, 0, 0);
  return new Date(midnight + (Date.now() - midnight) * (1 - hours / 24)).toISOString();
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
    createdAt: stageHistory[0]?.enteredAt ?? earlierToday(20),
    updatedAt: earlierToday(1),
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

function stubOpenAttention(items: Array<FactoryAutomationFailedAttentionItem | FactoryActivityAttentionItem>) {
  server.use(
    http.get('*/web/factory/projects/:id/attention', ({ request }) =>
      HttpResponse.json({
        items: itemsOfRequestedKinds(request, items),
        kinds: attentionKindSummaries(items),
        hasMore: false,
      }),
    ),
  );
}

function failedRun(workItemId: string): FactoryAutomationFailedAttentionItem {
  return {
    key: `factory:${FACTORY_ID}:attention:automation-failed:decision-1:1`,
    kind: 'automation-failed',
    decisionId: 'decision-1',
    occurrence: 1,
    workItemId,
    title: 'Card that failed',
    detail: 'No active Factory binding for role work.',
    decisionType: 'sendMessage',
    failureCode: 'source_control_missing',
    canRetry: true,
    occurredAt: earlierToday(1),
    read: false,
    target: { kind: 'thread', sessionId: 'session-1', threadId: 'thread-1' },
    archived: false,
  };
}

function renderActivity() {
  return renderWithProviders(
    <MemoryRouter>
      <ActivityTimeline factoryId={FACTORY_ID} />
    </MemoryRouter>,
  );
}

describe('Factory feed', () => {
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
        { stage: 'triage', enteredAt: earlierToday(4), by: 'agent:builder' },
        { stage: 'execute', enteredAt: earlierToday(3), by: 'agent:builder' },
        { stage: 'done', enteredAt: earlierToday(2), by: 'agent:builder' },
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
        occurredAt: earlierToday(1),
      },
    ]);
    renderActivity();

    expect(await screen.findByText('pushed to')).toBeInTheDocument();
    expect(screen.getByText('fix/thing')).toBeInTheDocument();
  });

  it('flags each card that needs you once, on its latest line', async () => {
    const stuck = card('Fix the flaky auth test', [
      { stage: 'execute', enteredAt: earlierToday(3), by: 'agent:builder' },
      { stage: 'review', enteredAt: earlierToday(2), by: 'user:u1' },
    ]);
    const fine = card('Bump vite to 7', [{ stage: 'done', enteredAt: earlierToday(4), by: 'agent:builder' }]);
    stubBoard([stuck, fine]);
    stubOpenAttention([failedRun(stuck.id)]);
    renderActivity();

    expect(await screen.findByText('Needs you')).toBeInTheDocument();
    expect(screen.getAllByText('Needs you')).toHaveLength(1);
    const [latest, earlier] = screen.getAllByRole('link', { name: 'Fix the flaky auth test' });
    expect(latest?.parentElement).toHaveTextContent('Needs you');
    expect(earlier?.parentElement).not.toHaveTextContent('Needs you');
  });

  it('leaves a card whose discussion merely moved on unflagged', async () => {
    const discussed = card('Fix the flaky auth test', [{ stage: 'review', enteredAt: earlierToday(2), by: 'user:u1' }]);
    stubBoard([discussed]);
    stubOpenAttention([
      {
        key: `factory:${FACTORY_ID}:attention:activity:${discussed.id}:1`,
        kind: 'activity',
        commentId: 'comment-1',
        authorId: 'u2',
        occurrence: 1,
        workItemId: discussed.id,
        title: 'Fix the flaky auth test',
        detail: 'Pushed a fix.',
        occurredAt: earlierToday(1),
        read: false,
        archived: false,
        target: { kind: 'work-item', workItemId: discussed.id, board: 'work' },
      },
    ]);
    const { client } = renderActivity();

    expect(await screen.findByRole('link', { name: 'Fix the flaky auth test' })).toBeInTheDocument();
    await waitForMutationsIdle(client);
    expect(screen.queryByText('Needs you')).not.toBeInTheDocument();
  });

  it('holds older board moves back until the audit trail has been read down to them', async () => {
    stubBoard([card('Old card', [{ stage: 'done', enteredAt: earlierToday(5), by: 'agent:builder' }])]);
    const event = (id: string, action: string, occurredAt: string) => ({
      id,
      actorId: 'u1',
      actorType: 'human',
      action,
      targets: [],
      metadata: { branch: `branch-${id}` },
      occurredAt,
    });
    server.use(
      http.get('*/web/factory/projects/:id/audit', ({ request }) =>
        new URL(request.url).searchParams.get('before') === 'page-2'
          ? HttpResponse.json({ events: [event('older', 'factory.agent.push', earlierToday(3))], actors: {} })
          : HttpResponse.json({
              events: [event('newer', 'factory.agent.push', earlierToday(1))],
              actors: {},
              nextCursor: 'page-2',
            }),
      ),
    );
    const user = userEvent.setup();
    renderActivity();

    expect(await screen.findByText('branch-newer')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Old card' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Load more activity' }));

    const oldMove = await screen.findByRole('link', { name: 'Old card' });
    const olderPush = screen.getByText('branch-older');
    expect(olderPush.compareDocumentPosition(oldMove) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('keeps reading the trail when its first page holds nothing to show yet', async () => {
    stubBoard([card('Old card', [{ stage: 'done', enteredAt: earlierToday(5), by: 'agent:builder' }])]);
    server.use(
      http.get('*/web/factory/projects/:id/audit', ({ request }) =>
        new URL(request.url).searchParams.get('before') === 'page-2'
          ? HttpResponse.json({ events: [], actors: {} })
          : HttpResponse.json({ events: [], actors: {}, nextCursor: 'page-2' }),
      ),
    );
    const user = userEvent.setup();
    renderActivity();

    const loadMore = await screen.findByRole('button', { name: 'Load more activity' });
    expect(screen.queryByRole('link', { name: 'Old card' })).not.toBeInTheDocument();
    await user.click(loadMore);

    expect(await screen.findByRole('link', { name: 'Old card' })).toBeInTheDocument();
    expect(screen.queryByText('Nothing has happened yet.')).not.toBeInTheDocument();
  });

  it('names an audit actor by the id its events carry', async () => {
    stubBoard([]);
    stubAudit(
      [
        {
          id: 'event-1',
          actorId: 'workos:user-7',
          actorType: 'human',
          action: 'factory.agent.push',
          targets: [],
          metadata: { branch: 'fix/thing' },
          occurredAt: earlierToday(1),
        },
      ],
      { 'workos:user-7': { id: 'user-7', name: 'Ada Lovelace' } },
    );
    renderActivity();

    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument();
  });

  it('lists each audit event on its own line once every event is shown', async () => {
    const shipped = card('Ship the release', [{ stage: 'execute', enteredAt: earlierToday(5), by: 'agent:builder' }]);
    stubBoard([shipped]);
    stubAudit(
      ['complete', 'aborted'].map((reason, index) => ({
        id: `run-${index}`,
        actorId: 'agent:builder',
        actorType: 'agent',
        action: 'factory.run.ended',
        targets: [{ type: 'work_item', id: shipped.id }],
        metadata: { reason },
        occurredAt: earlierToday(index + 1),
      })),
    );
    server.use(http.get('*/web/audit/portal-link', () => new HttpResponse(null, { status: 404 })));
    const user = userEvent.setup();
    renderActivity();

    expect(await screen.findByText('2 times')).toBeInTheDocument();
    expect(screen.getAllByText('ended a run on')).toHaveLength(1);

    await pickPropertyOption(user, 'Timeline properties', 'Group', 'None');

    expect(await screen.findAllByText('ended a run on')).toHaveLength(2);
    expect(screen.queryByText('2 times')).not.toBeInTheDocument();
    expect(screen.getByText('complete')).toBeInTheDocument();
    expect(screen.getByText('aborted')).toBeInTheDocument();
  });

  it('folds the cards of a sentence behind its count in compact view', async () => {
    stubBoard([
      card('Ship the docs', [{ stage: 'done', enteredAt: earlierToday(), by: 'agent:builder' }]),
      card('Ship the release', [{ stage: 'done', enteredAt: earlierToday(), by: 'agent:builder' }]),
    ]);
    const user = userEvent.setup();
    renderActivity();

    expect(await screen.findByRole('link', { name: 'Ship the docs' })).toBeInTheDocument();

    await openPropertiesMenu(user, 'Timeline properties');
    await user.click(screen.getByRole('menuitemcheckbox', { name: 'Compact view' }));
    await closePropertiesMenus(user);

    const count = screen.getByRole('button', { name: '2 cards' });
    expect(count).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('link', { name: 'Ship the docs' })).not.toBeInTheDocument();

    await user.click(count);
    expect(screen.getByRole('link', { name: 'Ship the docs' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ship the release' })).toBeInTheDocument();
  });

  it('says nothing has happened rather than drawing an empty rail', async () => {
    stubBoard([]);
    renderActivity();

    expect(await screen.findByText('Nothing has happened yet.')).toBeInTheDocument();
  });
});
