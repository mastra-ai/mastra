import { createEvent, fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { server } from '../../../../../../../e2e/ui/msw-server';
import { renderWithProviders, waitForMutationsIdle } from '../../../../../../../e2e/ui/render';
import type { LinkedRepositoryPayload } from '../../../../workspaces/services/github';
import { clockTime } from '../../../activity';
import type { AuditEvent } from '../../../services/audit';
import { SpotlightProvider } from '../spotlight';
import { Pulse } from './Pulse';

const FACTORY_ID = 'fp-1';
const HOUR = 3_600_000;

const reconnect = { id: 'wi-1', name: 'Fix reconnect' };
const keys = { id: 'wi-2', name: 'Rotate keys' };
const actors = { 'user-1': { id: 'user-1', name: 'Damien Schneider' } };
const linkedApp: LinkedRepositoryPayload = {
  projectRepositoryId: 'repository-1',
  provider: 'github',
  slug: 'acme/app',
};

function boardCard(card: { id: string; name: string }) {
  return {
    id: card.id,
    orgId: 'org1',
    createdBy: 'user-1',
    factoryProjectId: FACTORY_ID,
    parentWorkItemId: null,
    externalSource: null,
    title: card.name,
    stages: ['review'],
    stageHistory: [{ stage: 'review', enteredAt: new Date(Date.now() - HOUR).toISOString(), by: 'user-1' }],
    sessions: {},
    metadata: null,
    revision: 1,
    createdAt: new Date(Date.now() - 5 * HOUR).toISOString(),
    updatedAt: new Date(Date.now() - HOUR).toISOString(),
  };
}

function runEvent(
  side: 'started' | 'ended',
  kickoffId: string,
  minutesAgo: number,
  card: { id: string; name: string },
  metadata: Record<string, string>,
): AuditEvent {
  return {
    id: `${kickoffId}-${side}`,
    action: `factory.run.${side}`,
    actorId: side === 'ended' ? `agent:thread-${kickoffId}` : 'user-1',
    actorType: side === 'ended' ? 'agent' : 'human',
    targets: [{ type: 'work_item', ...card }],
    metadata: { kickoffId, threadId: `thread-${kickoffId}`, ...metadata },
    occurredAt: new Date(Date.now() - minutesAgo * 60_000).toISOString(),
  };
}

function threeRoles() {
  return [
    runEvent('started', 'review', 10, keys, { role: 'review', sessionId: 'session-review' }),
    runEvent('started', 'build', 20, reconnect, { role: 'work', sessionId: 'session-build' }),
    runEvent('ended', 'plan', 25, reconnect, { role: 'plan', sessionId: 'session-plan', reason: 'complete' }),
    runEvent('started', 'plan', 40, reconnect, { role: 'plan', sessionId: 'session-plan' }),
  ];
}

function stubPulse(runPagesByBeforeCursor: Record<string, { events: AuditEvent[]; nextCursor?: string }>) {
  const requestedRunCursors: string[] = [];
  server.use(
    http.get('*/web/factory/projects/:id/work-items', () =>
      HttpResponse.json({
        workItems: [boardCard(reconnect), boardCard(keys)],
        runningSessionIds: ['session-build'],
        parkedSessionIds: ['session-review'],
      }),
    ),
    http.get('*/web/factory/projects/:id/audit', ({ request }) => {
      const cursor = new URL(request.url).searchParams.get('before') ?? '';
      requestedRunCursors.push(cursor);
      return HttpResponse.json({ ...runPagesByBeforeCursor[cursor], actors });
    }),
  );
  return { requestedRunCursors };
}

function renderPulse(repositories: LinkedRepositoryPayload[] = []) {
  return renderWithProviders(
    <MemoryRouter>
      <SpotlightProvider>
        <Pulse factoryId={FACTORY_ID} repositories={repositories} />
      </SpotlightProvider>
    </MemoryRouter>,
  );
}

const lane = (name: string) => within(screen.getByRole('group', { name }));
const lanesLoaded = () => screen.findByRole('link', { name: /^Rotate keys, Review · Needs you/ });

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Pulse', () => {
  it('lays each role on its own lane: the finished plan, the build running now, and the review waiting on you', async () => {
    stubPulse({ '': { events: threeRoles() } });
    renderPulse();

    await lanesLoaded();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();

    expect(
      lane('Planning').getByRole('link', { name: /^Fix reconnect, Planning · Complete, .* · 15m$/ }),
    ).toHaveAttribute('href', `/factories/${FACTORY_ID}/work?item=wi-1`);
    expect(
      lane('Building').getByRole('link', { name: /^Fix reconnect, Building · Running, .* – now · 20m$/ }),
    ).toBeInTheDocument();
    expect(lane('Building').getByText('Fix reconnect')).toBeVisible();
    expect(lane('Review').getByRole('link', { name: /^Rotate keys, Review · Needs you/ })).toHaveAttribute(
      'href',
      `/factories/${FACTORY_ID}/work?item=wi-2`,
    );
    expect(lane('Triage').queryByRole('link')).not.toBeInTheDocument();
  });

  it('zooms in past a finished run, pans back to it from the keyboard, and returns to now', async () => {
    stubPulse({ '': { events: threeRoles() } });
    const user = userEvent.setup();
    renderPulse();

    await lanesLoaded();
    expect(lane('Planning').getByRole('link')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Now' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Zoom in' }));
    await user.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect(lane('Planning').queryByRole('link')).not.toBeInTheDocument();
    expect(lane('Building').getByRole('link')).toBeInTheDocument();

    screen.getByRole('group', { name: /^Agent runs over time/ }).focus();
    await user.keyboard('{ArrowLeft}{ArrowLeft}{ArrowLeft}');
    expect(lane('Planning').getByRole('link', { name: /^Fix reconnect, Planning/ })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Now' }));
    expect(lane('Planning').queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Now' })).not.toBeInTheDocument();
  });

  it('moves back in time on a sideways swipe over the lane names, keeping the whole swipe from the browser', async () => {
    stubPulse({ '': { events: threeRoles() } });
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 800, 40));
    renderPulse();
    await lanesLoaded();
    const laneName = screen.getByText('Planning');

    const swipe = createEvent.wheel(laneName, { deltaX: -120 });
    const verticalDriftMidSwipe = createEvent.wheel(laneName, { deltaX: 0, deltaY: 3 });
    fireEvent(laneName, swipe);
    fireEvent(laneName, verticalDriftMidSwipe);

    expect(swipe.defaultPrevented).toBe(true);
    expect(verticalDriftMidSwipe.defaultPrevented).toBe(true);
    expect(await screen.findByRole('button', { name: 'Now' })).toBeInTheDocument();
  });

  it('reads older runs only once the view reaches back to them', async () => {
    const [review, build] = threeRoles();
    if (!review || !build) throw new Error('Expected the review and build runs');
    const { requestedRunCursors } = stubPulse({
      '': { events: [review, build], nextCursor: 'page-2' },
      'page-2': {
        events: [runEvent('started', 'triage', 70, keys, { role: 'triage', sessionId: 'session-triage' })],
        nextCursor: 'page-3',
      },
      'page-3': {
        events: [
          runEvent('ended', 'old-plan', 100, reconnect, { role: 'plan', sessionId: 'session-old', reason: 'complete' }),
          runEvent('started', 'old-plan', 110, reconnect, { role: 'plan', sessionId: 'session-old' }),
        ],
      },
    });
    const user = userEvent.setup();
    const { client } = renderPulse();

    await lanesLoaded();
    expect(await lane('Triage').findByRole('link', { name: /^Rotate keys, Triage/ })).toBeInTheDocument();
    await waitForMutationsIdle(client);
    expect(lane('Planning').queryByRole('link')).not.toBeInTheDocument();
    expect(requestedRunCursors).toContain('page-2');
    expect(requestedRunCursors).not.toContain('page-3');

    await user.click(screen.getByRole('button', { name: 'Zoom out' }));

    expect(
      await lane('Planning').findByRole('link', { name: /^Fix reconnect, Planning · Complete/ }),
    ).toBeInTheDocument();
    await waitForMutationsIdle(client);
    expect(requestedRunCursors.filter(cursor => cursor === 'page-3')).toHaveLength(1);
  });

  it('reads out when a run started and ended on the time axis while it is hovered', async () => {
    const roles = threeRoles();
    stubPulse({ '': { events: roles } });
    const user = userEvent.setup();
    renderPulse();
    const [, , planEnded, planStarted] = roles;
    const startedAt = new RegExp(clockTime(Date.parse(planStarted?.occurredAt ?? '')));
    const endedAt = new RegExp(clockTime(Date.parse(planEnded?.occurredAt ?? '')));

    await lanesLoaded();
    const chart = within(screen.getByRole('group', { name: /^Agent runs over time/ }));
    expect(chart.queryByText(startedAt)).not.toBeInTheDocument();

    await user.hover(lane('Planning').getByRole('link'));
    expect(chart.getByText(startedAt)).toBeInTheDocument();
    expect(chart.getByText(endedAt)).toBeInTheDocument();

    await user.unhover(lane('Planning').getByRole('link'));
    expect(chart.queryByText(startedAt)).not.toBeInTheDocument();
  });
});

describe('Pulse, codebase lane', () => {
  it('marks each recent commit on the codebase lane, linking to it on GitHub', async () => {
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 800, 40));
    stubPulse({ '': { events: threeRoles() } });
    const commitUrl = 'https://github.com/acme/app/commit/abcdef1234567890';
    server.use(
      http.get('*/web/github/projects/:id/commits', () =>
        HttpResponse.json({
          branch: 'main',
          commits: [
            {
              sha: 'abcdef1234567890',
              message: 'Retry the socket on reconnect',
              author: 'ada',
              avatarUrl: null,
              committedAt: new Date(Date.now() - 15 * 60_000).toISOString(),
              url: commitUrl,
            },
            {
              sha: 'fedcba0987654321',
              message: 'Older than the window',
              author: 'ada',
              avatarUrl: null,
              committedAt: new Date(Date.now() - 5 * HOUR).toISOString(),
              url: 'https://github.com/acme/app/commit/fedcba0987654321',
            },
          ],
        }),
      ),
    );
    renderPulse([linkedApp]);

    const commits = within(await screen.findByRole('group', { name: 'Commits on acme/app' }));
    expect(
      await commits.findByRole('link', { name: /^Commit Retry the socket on reconnect, ada · abcdef1, / }),
    ).toHaveAttribute('href', commitUrl);
    expect(commits.getAllByRole('link')).toHaveLength(1);
  });

  it('says GitHub could not be reached when the first commits load fails', async () => {
    stubPulse({ '': { events: threeRoles() } });
    server.use(http.get('*/web/github/projects/:id/commits', () => new HttpResponse(null, { status: 502 })));
    renderPulse([linkedApp]);

    const commits = within(await screen.findByRole('group', { name: 'Commits on acme/app' }));
    expect(await commits.findByText('Could not reach GitHub for commits.')).toBeInTheDocument();
    expect(commits.queryByRole('link')).not.toBeInTheDocument();
  });

  it('points to repository settings when no repository is linked', async () => {
    stubPulse({ '': { events: threeRoles() } });
    renderPulse();

    expect(await screen.findByRole('link', { name: 'Link repository' })).toHaveAttribute(
      'href',
      `/factories/${FACTORY_ID}/settings/repositories`,
    );
  });
});
