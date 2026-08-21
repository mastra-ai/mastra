import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { server } from '../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../e2e/ui/render';
import type { AuditEvent } from '../domains/factory/services/audit';
import { createAppRoutes } from '../router';

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

function renderAudit() {
  const router = createMemoryRouter(createAppRoutes(), { initialEntries: [`/factories/${FACTORY_ID}/audit`] });
  renderWithProviders(<RouterProvider router={router} />);
}

afterEach(() => vi.unstubAllGlobals());

describe('Audit log', () => {
  it('shows event density, custom rows, expandable details, and automatically fetches the next page', async () => {
    vi.stubGlobal('IntersectionObserver', ImmediateIntersectionObserver);
    const requestedCursors: Array<string | null> = [];
    const recent = event('event-recent', {
      metadata: { from: 'planning', to: 'execute', decisionId: 'decision-9' },
    });
    const older = event('event-older', {
      actorId: 'agent:thread-9',
      actorType: 'agent',
      action: 'factory.run.started',
      metadata: { agentName: 'Build agent', branch: 'factory/wi-1' },
      occurredAt: new Date(Date.now() - 3 * 24 * HOUR).toISOString(),
    });

    server.use(
      http.get(`${TEST_BASE_URL}/auth/me`, () =>
        HttpResponse.json({ authenticated: true, authEnabled: true, user: { userId: 'user-1' } }),
      ),
      http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
        HttpResponse.json({ projects: [{ id: FACTORY_ID, name: 'Acme Factory' }] }),
      ),
      http.get(`${TEST_BASE_URL}/api/agent-controller/code/sessions/${FACTORY_ID}/permissions`, () =>
        HttpResponse.json({ categories: {}, tools: {} }),
      ),
      http.get(`${TEST_BASE_URL}/web/audit/portal-link`, () => new HttpResponse(null, { status: 404 })),
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/audit`, ({ request }) => {
        const cursor = new URL(request.url).searchParams.get('before');
        requestedCursors.push(cursor);
        const actors = { 'user-1': { id: 'user-1', name: 'Damien Schneider' } };
        return cursor
          ? HttpResponse.json({ events: [older], actors })
          : HttpResponse.json({ events: [recent], actors, nextCursor: 'page-2' });
      }),
    );

    const user = userEvent.setup();
    renderAudit();

    expect(await screen.findByRole('slider', { name: 'Audit time range' })).toBeInTheDocument();
    expect(await screen.findByText('Planning → Building')).toBeInTheDocument();
    expect(screen.getByText('Damien Schneider')).toBeInTheDocument();

    await waitFor(() => expect(requestedCursors).toEqual([null, 'page-2']));
    expect(await screen.findByText('Run started')).toBeInTheDocument();
    expect(screen.getByText('Build agent')).toBeInTheDocument();

    const recentRow = screen.getByRole('button', { expanded: false, name: /Stage moved/ });
    await user.click(recentRow);
    expect(recentRow).toHaveAttribute('aria-expanded', 'true');
    expect(within(recentRow.parentElement ?? recentRow).getByText(/decision-9/)).toBeInTheDocument();

    const olderRow = screen.getByRole('button', { expanded: false, name: /Run started/ });
    await user.click(olderRow);
    expect(olderRow).toHaveAttribute('aria-expanded', 'true');
    expect(recentRow).toHaveAttribute('aria-expanded', 'true');

    const timeline = screen.getByRole('slider', { name: 'Audit time range' });
    await user.click(timeline);
    expect(timeline).toHaveFocus();
    await user.keyboard('{ArrowUp}');
    const reset = screen.getByRole('button', { name: 'Reset' });
    await user.click(reset);
    expect(screen.queryByRole('button', { name: 'Reset' })).not.toBeInTheDocument();

    const startDate = screen.getByRole('button', { name: 'Start date' });
    expect(startDate).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'End date' })).toBeInTheDocument();
    await user.click(startDate);
    expect(await screen.findByTestId('datepicker-calendar')).toBeInTheDocument();
    await user.keyboard('{Escape}');

    await user.click(screen.getByRole('button', { name: 'Runs' }));
    expect(await screen.findByRole('button', { name: 'Runs' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: 'Agent' }));
    expect(await screen.findByRole('button', { name: 'Runs' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Agent' })).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByRole('button', { name: 'All' }));
    expect(await screen.findByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Runs' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Agent' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('keeps category toggles available when the log is empty', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/auth/me`, () =>
        HttpResponse.json({ authenticated: true, authEnabled: true, user: { userId: 'user-1' } }),
      ),
      http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
        HttpResponse.json({ projects: [{ id: FACTORY_ID, name: 'Acme Factory' }] }),
      ),
      http.get(`${TEST_BASE_URL}/api/agent-controller/code/sessions/${FACTORY_ID}/permissions`, () =>
        HttpResponse.json({ categories: {}, tools: {} }),
      ),
      http.get(`${TEST_BASE_URL}/web/audit/portal-link`, () => new HttpResponse(null, { status: 404 })),
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/audit`, () =>
        HttpResponse.json({ events: [], actors: {} }),
      ),
    );

    const user = userEvent.setup();
    renderAudit();

    expect(await screen.findByRole('heading', { name: 'No audit events yet' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Audit categories' })).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: 'Audit time range' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Runs' }));
    expect(await screen.findByRole('heading', { name: 'No matching audit events' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Audit categories' })).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: 'Audit time range' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Runs' })).toHaveAttribute('aria-pressed', 'true');
  });
});
