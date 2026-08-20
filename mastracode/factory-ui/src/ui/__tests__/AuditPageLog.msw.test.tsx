import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { server } from '../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../e2e/ui/render';
import type { AuditEvent } from '../domains/factory/services/audit';
import { createAppRoutes } from '../router';

const FACTORY_ID = 'fp-1';
const HOUR = 3_600_000;
const CARD_ID = 'wi-1';

const ago = (ms: number) => new Date(Date.now() - ms).toISOString();

function event(id: string, overrides: Partial<AuditEvent>): AuditEvent {
  return {
    id,
    orgId: 'org-1',
    actorId: 'user-1',
    actorType: 'human',
    action: 'factory.work_item.stage_moved',
    targets: [{ type: 'work_item', id: CARD_ID }],
    metadata: {},
    githubProjectId: null,
    context: {},
    occurredAt: ago(HOUR),
    ...overrides,
  };
}

const RECENT = event('ev-recent', {
  metadata: { from: 'planning', to: 'execute', decisionId: 'decision-9' },
});

const OLDER = event('ev-older', {
  actorId: 'agent:thread-9',
  actorType: 'agent',
  action: 'factory.run.started',
  metadata: { branch: 'factory/wi-1', agentName: 'build agent', sessionId: 'sess-1' },
  occurredAt: ago(3 * 24 * HOUR),
});

let requested: URL[] = [];

function stubAuditEndpoints() {
  requested = [];
  server.use(
    http.get(`${TEST_BASE_URL}/auth/me`, () =>
      HttpResponse.json({ authenticated: true, authEnabled: true, user: { userId: 'user-1' } }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
      HttpResponse.json({ projects: [{ id: FACTORY_ID, name: 'Acme Factory' }] }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items`, () =>
      HttpResponse.json({
        workItems: [
          {
            id: CARD_ID,
            orgId: 'org-1',
            createdBy: 'user-1',
            factoryProjectId: FACTORY_ID,
            externalSource: null,
            parentWorkItemId: null,
            title: 'Fix the flaky reconnect',
            stages: ['execute'],
            stageHistory: [],
            sessions: {},
            metadata: {},
            revision: 1,
            createdAt: ago(4 * 24 * HOUR),
            updatedAt: ago(HOUR),
          },
        ],
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/audit/portal-link`, () => new HttpResponse(null, { status: 404 })),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/audit`, ({ request }) => {
      const url = new URL(request.url);
      requested.push(url);
      const actors = { 'user-1': { id: 'user-1', name: 'Damien Schneider' } };
      return url.searchParams.get('before')
        ? HttpResponse.json({ events: [OLDER], actors })
        : HttpResponse.json({ events: [RECENT], actors, nextCursor: 'page-2' });
    }),
  );
}

function renderAudit() {
  const router = createMemoryRouter(createAppRoutes(), { initialEntries: [`/factories/${FACTORY_ID}/audit`] });
  return renderWithProviders(<RouterProvider router={router} />);
}

beforeEach(stubAuditEndpoints);

describe('Audit log', () => {
  it('reads one line per event: what happened, and to which card', async () => {
    renderAudit();

    expect(await screen.findByText('Stage moved')).toBeInTheDocument();
    expect(screen.getByText('Planning → Building')).toBeInTheDocument();
    expect(screen.getAllByText('Fix the flaky reconnect').length).toBeGreaterThan(0);
    expect(screen.getByText('build agent')).toBeInTheDocument();
  });

  // The read API only pages backwards from a cursor. Stopping at the first page
  // would leave the strip drawing a seven-day window it had only read an hour of.
  it('walks the trail back to the floor of the window instead of stopping at one page', async () => {
    renderAudit();

    expect(await screen.findByText('Run started')).toBeInTheDocument();
    expect(requested.map(url => url.searchParams.get('before'))).toEqual([null, 'page-2']);
  });

  // Holding the whole window is what makes narrowing honest: the filter hides
  // rows that were fetched, not rows a cursor never reached.
  it('narrows the window it already holds rather than fetching a filtered one', async () => {
    renderAudit();
    await screen.findByText('Run started');
    const reads = requested.length;

    await userEvent.click(screen.getByRole('button', { name: 'People' }));

    expect(screen.queryByText('Run started')).not.toBeInTheDocument();
    expect(screen.getByText('Stage moved')).toBeInTheDocument();
    expect(requested.length).toBe(reads);
  });

  it('expands a row onto the ids the columns leave out', async () => {
    renderAudit();

    await userEvent.click(await screen.findByRole('button', { expanded: false, name: /Stage moved/ }));

    const row = screen.getByRole('button', { expanded: true, name: /Stage moved/ }).parentElement!;
    expect(within(row).getByText('decisionId')).toBeInTheDocument();
    expect(within(row).getByText('decision-9')).toBeInTheDocument();
  });
});
