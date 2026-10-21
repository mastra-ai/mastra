import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { closePropertiesMenus, openPropertySubmenu, togglePropertyOption } from '../../../../e2e/ui/properties-menu';
import { server } from '../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '../../../../e2e/ui/render';
import type { AuditEvent } from '../../domains/factory/services/audit';
import { createAppRoutes } from '../../router';

const FACTORY_ID = 'fp-1';
const HOUR = 3_600_000;

class ImmediateIntersectionObserver implements IntersectionObserver {
  readonly root: Element | Document | null = null;
  readonly rootMargin = '0px';
  readonly scrollMargin = '0px';
  readonly thresholds = [0];

  constructor(private readonly callback: IntersectionObserverCallback) {}

  disconnect() {}

  observe(target: Element) {
    const rect = target.getBoundingClientRect();
    this.callback(
      [
        {
          boundingClientRect: rect,
          intersectionRatio: 1,
          intersectionRect: rect,
          isIntersecting: true,
          rootBounds: null,
          target,
          time: 0,
        },
      ],
      this,
    );
  }

  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }

  unobserve() {}
}

function event(id: string, overrides: Partial<AuditEvent>): AuditEvent {
  return {
    id,
    actorId: 'user-1',
    actorType: 'human',
    action: 'factory.work_item.stage_moved',
    targets: [{ type: 'work_item', id: 'wi-1', name: 'Fix reconnect' }],
    metadata: {},
    occurredAt: new Date(Date.now() - HOUR).toISOString(),
    ...overrides,
  };
}

const boardCard = {
  id: 'wi-1',
  orgId: 'org1',
  createdBy: 'user-1',
  factoryProjectId: FACTORY_ID,
  parentWorkItemId: null,
  externalSource: null,
  title: 'Fix reconnect',
  stages: ['review'],
  stageHistory: [{ stage: 'review', enteredAt: new Date(Date.now() - HOUR).toISOString(), by: 'user-1' }],
  sessions: {},
  metadata: null,
  revision: 1,
  createdAt: new Date(Date.now() - 5 * HOUR).toISOString(),
  updatedAt: new Date(Date.now() - HOUR).toISOString(),
};

const actors = { 'user-1': { id: 'user-1', name: 'Damien Schneider' } };

function baseHandlers() {
  return [
    http.get(`${TEST_BASE_URL}/auth/me`, () =>
      HttpResponse.json({ authenticated: true, authEnabled: true, user: { userId: 'user-1' } }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
      HttpResponse.json({ projects: [{ id: FACTORY_ID, name: 'Acme Factory' }] }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items`, () =>
      HttpResponse.json({ workItems: [boardCard] }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/sessions`, () => HttpResponse.json({ sessions: [] })),
    http.get(`${TEST_BASE_URL}/api/agent-controller/code/sessions/${FACTORY_ID}/permissions`, () =>
      HttpResponse.json({ categories: {}, tools: {} }),
    ),
    http.get(`${TEST_BASE_URL}/web/audit/portal-link`, () => new HttpResponse(null, { status: 404 })),
  ];
}

function renderAudit() {
  const router = createMemoryRouter(createAppRoutes(), { initialEntries: [`/factories/${FACTORY_ID}/audit`] });
  return renderWithProviders(<RouterProvider router={router} />);
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Activity page, ungrouped', () => {
  it('lands the old audit URL ungrouped, one line per event, fetching the next page as it scrolls', async () => {
    vi.stubGlobal('IntersectionObserver', ImmediateIntersectionObserver);
    const requestedCursors: Array<string | null> = [];
    const moved = event('event-moved', { metadata: { from: 'execute', to: 'review' } });
    const started = event('event-started', {
      actorId: 'agent:thread-9',
      actorType: 'agent',
      action: 'factory.run.started',
      targets: [{ type: 'work_item', id: 'wi-1' }],
      metadata: { agentName: 'Build agent', decisionId: 'decision-9', __actorProfile: { name: 'Stored profile' } },
      occurredAt: new Date(Date.now() - 2 * HOUR).toISOString(),
    });

    server.use(
      ...baseHandlers(),
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/audit`, ({ request }) => {
        const params = new URL(request.url).searchParams;
        if (params.has('namespaces')) return HttpResponse.json({ events: [], actors: {} });
        const cursor = params.get('before');
        requestedCursors.push(cursor);
        return cursor
          ? HttpResponse.json({ events: [started], actors })
          : HttpResponse.json({ events: [moved], actors, nextCursor: 'page-2' });
      }),
    );

    const user = userEvent.setup();
    const { client } = renderAudit();

    expect(await screen.findByText('started a run on', undefined, { timeout: 5_000 })).toBeInTheDocument();
    await openPropertySubmenu(user, 'Timeline properties', 'Group');
    expect(screen.getByRole('menuitemradio', { name: 'None' })).toHaveAttribute('aria-checked', 'true');
    await closePropertiesMenus(user);
    await waitForMutationsIdle(client);
    expect(requestedCursors).toEqual([null, 'page-2']);

    expect(screen.getByText('Damien Schneider')).toBeInTheDocument();
    expect(screen.getByText('moved')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Fix reconnect' })).toHaveLength(2);
    expect(screen.queryByText(/decisionId/)).not.toBeInTheDocument();

    const [moveDetails, runDetails] = screen.getAllByRole('button', { name: 'Details' });
    if (!moveDetails || !runDetails) throw new Error('Expected a Details toggle on both events');
    await user.click(moveDetails);
    expect(await screen.findByText(/"from"/)).toBeInTheDocument();

    expect(runDetails).toHaveAttribute('aria-expanded', 'false');
    await user.click(runDetails);
    expect(runDetails).toHaveAttribute('aria-expanded', 'true');
    expect(await screen.findByText(/"decisionId"/)).toBeInTheDocument();
    expect(screen.queryByText(/__actorProfile/)).not.toBeInTheDocument();
  });

  it('asks the server for the chosen categories and offers a way back when none match', async () => {
    const requestedNamespaces: Array<string | null> = [];
    server.use(
      ...baseHandlers(),
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/audit`, ({ request }) => {
        const namespaces = new URL(request.url).searchParams.get('namespaces');
        requestedNamespaces.push(namespaces);
        return namespaces
          ? HttpResponse.json({ events: [], actors: {} })
          : HttpResponse.json({ events: [event('event-moved', { metadata: { to: 'review' } })], actors });
      }),
    );

    const user = userEvent.setup();
    renderAudit();

    expect(await screen.findByText('moved', undefined, { timeout: 5_000 })).toBeInTheDocument();

    await togglePropertyOption(user, 'Timeline properties', 'Filter', 'Runs');
    expect(screen.getByRole('button', { name: 'Timeline properties, 2 changed' })).toBeInTheDocument();
    expect(await screen.findByText('No events in these categories.')).toBeInTheDocument();

    await togglePropertyOption(user, 'Timeline properties', 'Filter', 'Git');
    await waitFor(() => expect(requestedNamespaces).toContain('run,git'));

    await user.click(screen.getByRole('button', { name: 'Show all events' }));
    expect(await screen.findByText('moved')).toBeInTheDocument();
    await openPropertySubmenu(user, 'Timeline properties', 'Filter');
    expect(screen.getByRole('menuitemcheckbox', { name: 'All events' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('menuitemcheckbox', { name: 'Runs' })).toHaveAttribute('aria-checked', 'false');
  });
});

describe('Activity page, Pulse and timeline together', () => {
  const reconnect = { id: 'wi-1', name: 'Fix reconnect' };
  const keys = { id: 'wi-2', name: 'Rotate keys' };

  function runEvent(
    side: 'started' | 'ended',
    kickoffId: string,
    minutesAgo: number,
    card: { id: string; name: string },
    metadata: Record<string, string>,
  ): AuditEvent {
    return event(`${kickoffId}-${side}`, {
      action: `factory.run.${side}`,
      actorId: side === 'ended' ? `agent:thread-${kickoffId}` : 'user-1',
      actorType: side === 'ended' ? 'agent' : 'human',
      targets: [{ type: 'work_item', ...card }],
      metadata: { kickoffId, threadId: `thread-${kickoffId}`, ...metadata },
      occurredAt: new Date(Date.now() - minutesAgo * 60_000).toISOString(),
    });
  }

  function threeRoles() {
    return [
      runEvent('started', 'review', 10, keys, { role: 'review', sessionId: 'session-review' }),
      runEvent('started', 'build', 20, reconnect, { role: 'work', sessionId: 'session-build' }),
      runEvent('ended', 'plan', 25, reconnect, { role: 'plan', sessionId: 'session-plan', reason: 'complete' }),
      runEvent('started', 'plan', 40, reconnect, { role: 'plan', sessionId: 'session-plan' }),
    ];
  }

  function stubActivity(events: AuditEvent[]) {
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items`, () =>
        HttpResponse.json({
          workItems: [boardCard, { ...boardCard, id: 'wi-2', title: 'Rotate keys' }],
          runningSessionIds: ['session-build'],
          parkedSessionIds: ['session-review'],
        }),
      ),
      ...baseHandlers(),
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/audit`, ({ request }) =>
        HttpResponse.json({ events: new URL(request.url).searchParams.has('before') ? [] : events, actors }),
      ),
    );
  }

  function renderActivity() {
    const router = createMemoryRouter(createAppRoutes(), { initialEntries: [`/factories/${FACTORY_ID}/activity`] });
    return renderWithProviders(<RouterProvider router={router} />);
  }

  const lane = (name: string) => within(screen.getByRole('group', { name }));

  it('highlights only the hovered run in the timeline, not every event on its card', async () => {
    stubActivity(threeRoles());
    const user = userEvent.setup();
    renderActivity();
    await screen.findByRole('link', { name: /^Rotate keys, Review · Needs you/ }, { timeout: 5_000 });
    const timeline = await screen.findByRole('region', { name: 'Timeline' });
    await within(timeline).findAllByText(/ended a run/);
    const spotlitRows = () => [...timeline.querySelectorAll('li[data-spotlit]')].map(row => row.textContent ?? '');

    await user.hover(lane('Planning').getByRole('link'));
    expect(spotlitRows()).toEqual([expect.stringMatching(/ended a run/), expect.stringMatching(/started a run/)]);

    await user.hover(lane('Building').getByRole('link'));
    expect(spotlitRows()).toEqual([expect.stringMatching(/started a run/)]);
  });
});
