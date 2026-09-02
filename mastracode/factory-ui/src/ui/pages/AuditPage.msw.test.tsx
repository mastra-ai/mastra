import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { server } from '../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '../../../e2e/ui/render';
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

function baseHandlers() {
  return [
    http.get(`${TEST_BASE_URL}/auth/me`, () =>
      HttpResponse.json({ authenticated: true, authEnabled: true, user: { userId: 'user-1' } }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
      HttpResponse.json({ projects: [{ id: FACTORY_ID, name: 'Acme Factory' }] }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items`, () =>
      HttpResponse.json({ workItems: [] }),
    ),
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

afterEach(() => vi.unstubAllGlobals());

describe('Audit log', () => {
  it('shows event density, custom rows, expandable details, and automatically fetches the next page', async () => {
    vi.stubGlobal('IntersectionObserver', ImmediateIntersectionObserver);
    const requestedCursors: Array<string | null> = [];
    const recent = event('event-recent', {
      metadata: {
        to: 'review',
        decisionId: 'decision-9',
        __actorProfile: { name: 'Stored profile' },
      },
    });
    const older = event('event-older', {
      actorId: 'agent:thread-9',
      actorType: 'agent',
      action: 'factory.run.started',
      metadata: { agentName: 'Build agent', branch: 'factory/wi-1' },
      occurredAt: new Date(Date.now() - 3 * 24 * HOUR).toISOString(),
    });

    server.use(
      ...baseHandlers(),
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/audit`, ({ request }) => {
        const cursor = new URL(request.url).searchParams.get('before');
        requestedCursors.push(cursor);
        const actors = { 'user-1': { id: 'canonical-user-1', name: 'Damien Schneider' } };
        return cursor
          ? HttpResponse.json({ events: [older], actors })
          : HttpResponse.json({ events: [recent], actors, nextCursor: 'page-2' });
      }),
    );

    const user = userEvent.setup();
    const { client } = renderAudit();

    expect(await screen.findByRole('slider', { name: 'Range start' })).toBeInTheDocument();
    expect(await screen.findByText('→ Review')).toBeInTheDocument();
    expect(screen.getByText('Damien Schneider')).toBeInTheDocument();

    await waitForMutationsIdle(client);
    expect(requestedCursors).toEqual([null, 'page-2']);
    expect(screen.getByText('Run started')).toBeInTheDocument();
    expect(screen.getByText('Build agent')).toBeInTheDocument();

    const recentRow = screen.getByRole('button', { expanded: false, name: /Stage moved/ });
    await user.click(recentRow);
    expect(recentRow).toHaveAttribute('aria-expanded', 'true');
    expect(within(recentRow.parentElement ?? recentRow).getByText(/decision-9/)).toBeInTheDocument();
    expect(within(recentRow.parentElement ?? recentRow).queryByText(/__actorProfile/)).not.toBeInTheDocument();

    const olderRow = screen.getByRole('button', { expanded: false, name: /Run started/ });
    await user.click(olderRow);
    expect(olderRow).toHaveAttribute('aria-expanded', 'true');
    expect(recentRow).toHaveAttribute('aria-expanded', 'true');

    const rangeEnd = screen.getByRole('slider', { name: 'Range end' });

    fireEvent.pointerDown(rangeEnd, { pointerType: 'mouse', button: 2 });
    fireEvent.pointerUp(rangeEnd, { pointerType: 'mouse', button: 2 });
    expect(screen.getByText('2 loaded')).toBeInTheDocument();

    await user.click(rangeEnd);
    expect(rangeEnd).toHaveFocus();
    await user.keyboard('{ArrowLeft}');
    expect(await screen.findByText(/1 of 2 loaded$/)).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(await screen.findByText('2 loaded')).toBeInTheDocument();

    // Narrow screens get chips instead of the lens; a preset shorter than the
    // loaded span is offered, a longer one is not.
    const presets = within(screen.getByRole('group', { name: 'Audit time range' }));
    expect(presets.getByRole('button', { name: '24h' })).toHaveAttribute('aria-pressed', 'false');
    expect(presets.queryByRole('button', { name: '7d' })).not.toBeInTheDocument();
    await user.click(presets.getByRole('button', { name: '24h' }));
    expect(presets.getByRole('button', { name: '24h' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(presets.getByRole('button', { name: 'All' }));
    expect(await screen.findByText('2 loaded')).toBeInTheDocument();

    const categories = within(screen.getByRole('group', { name: 'Audit categories' }));
    await user.click(categories.getByRole('button', { name: 'Runs' }));
    await waitFor(() =>
      expect(categories.getByRole('button', { name: 'Runs' })).toHaveAttribute('aria-pressed', 'true'),
    );
    await user.click(categories.getByRole('button', { name: 'Agent' }));
    expect(categories.getByRole('button', { name: 'Runs' })).toHaveAttribute('aria-pressed', 'true');
    expect(categories.getByRole('button', { name: 'Agent' })).toHaveAttribute('aria-pressed', 'true');

    await user.click(categories.getByRole('button', { name: 'All' }));
    await waitFor(() =>
      expect(categories.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true'),
    );
    expect(categories.getByRole('button', { name: 'Runs' })).toHaveAttribute('aria-pressed', 'false');
    expect(categories.getByRole('button', { name: 'Agent' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('keeps category toggles available when the log is empty', async () => {
    server.use(
      ...baseHandlers(),
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/audit`, () =>
        HttpResponse.json({ events: [], actors: {} }),
      ),
    );

    const user = userEvent.setup();
    renderAudit();

    expect(await screen.findByRole('heading', { name: 'No audit events yet' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Audit categories' })).toBeInTheDocument();
    // Nothing recorded means no axis to draw a range on, so the ruler stays away.
    expect(screen.getByText('Nothing recorded yet')).toBeInTheDocument();
    expect(screen.queryByRole('slider')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Runs' }));
    expect(await screen.findByRole('heading', { name: 'No events in these categories' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Audit categories' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Runs' })).toHaveAttribute('aria-pressed', 'true');
  });
});
