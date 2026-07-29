// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, MemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import SignalsOverviewPage from '..';
import { navHandle } from '../../../lib/nav';
import { RouteHeader } from '../../../lib/route-header/route-header';
import {
  drilldownThemeFlowResponse,
  firstThemeExamplesResponse,
  themeDetailResponse,
  themeHistoryResponse,
  traceInsightResponse,
} from './fixtures/theme-drilldown';
import {
  billingThemeSnapshotsResponse,
  emptyThemeEntitiesResponse,
  emptyThemeSnapshotsResponse,
  lowSignalFirstThemeEntitiesResponse,
  multiAgentThemeEntitiesResponse,
  multiEligibleThemeEntitiesResponse,
  populatedThemeEntitiesResponse,
  themeFlowResponse,
  themeSnapshotsResponse,
} from './fixtures/theme-flow';
import { server } from '@/test/msw-server';

const BASE_URL = window.location.origin;

function renderSignalsPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <SignalsOverviewPage />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

function renderSignalsPageWithShell() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(
    [
      {
        path: '/intelligence',
        handle: navHandle('/intelligence'),
        element: (
          <QueryClientProvider client={queryClient}>
            <RouteHeader />
            <SignalsOverviewPage />
          </QueryClientProvider>
        ),
      },
    ],
    { initialEntries: ['/intelligence'] },
  );
  return render(<RouterProvider router={router} />);
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Signals page', () => {
  describe('when the entities request is pending', () => {
    it('shows the Signals loading state', async () => {
      server.use(
        http.get(`${BASE_URL}/api/learning/entities`, async () => {
          await new Promise(() => {});
          return HttpResponse.json(emptyThemeEntitiesResponse);
        }),
      );

      renderSignalsPage();

      expect(await screen.findByRole('status', { name: 'Loading trace intelligence' })).not.toBeNull();
    });
  });

  describe('when the entities request fails', () => {
    it('shows the entities error state', async () => {
      server.use(
        http.get(`${BASE_URL}/api/learning/entities`, () =>
          HttpResponse.json({ error: 'Unable to load entities' }, { status: 500 }),
        ),
      );

      renderSignalsPage();

      expect(await screen.findByText('Unable to load trace intelligence entities.')).not.toBeNull();
    });
  });

  describe('when the entities request fails once', () => {
    it('retries the failed request and renders the page', async () => {
      let attempts = 0;
      server.use(
        http.get(`${BASE_URL}/api/learning/entities`, () => {
          attempts += 1;
          return attempts === 1
            ? HttpResponse.json({ error: 'Unable to load entities' }, { status: 500 })
            : HttpResponse.json(populatedThemeEntitiesResponse);
        }),
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-snapshots`, () =>
          HttpResponse.json(themeSnapshotsResponse),
        ),
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-flow`, () =>
          HttpResponse.json(themeFlowResponse),
        ),
      );

      renderSignalsPage();

      expect(await screen.findByText('Unable to load trace intelligence entities.')).not.toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

      expect(await screen.findByRole('combobox', { name: 'Agent' })).not.toBeNull();
      expect(attempts).toBe(2);
    });
  });

  describe('when no Agent Learning entities exist', () => {
    it('shows that the analysis is waiting for traces', async () => {
      server.use(http.get(`${BASE_URL}/api/learning/entities`, () => HttpResponse.json(emptyThemeEntitiesResponse)));

      renderSignalsPage();

      expect(await screen.findByText('Waiting for traces.')).not.toBeNull();
    });
  });

  describe('when an agent has theme flow data', () => {
    beforeEach(() => {
      server.use(
        http.get(`${BASE_URL}/api/learning/entities`, () => HttpResponse.json(populatedThemeEntitiesResponse)),
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-snapshots`, () =>
          HttpResponse.json(themeSnapshotsResponse),
        ),
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-flow`, () =>
          HttpResponse.json(themeFlowResponse),
        ),
      );
    });

    it('labels the populated analysis', async () => {
      renderSignalsPage();

      expect(
        await screen.findByRole('heading', { name: 'Understand what drives every agent interaction' }),
      ).not.toBeNull();
    });

    it('exposes the theme flow as a named region', async () => {
      renderSignalsPage();

      expect(await screen.findByRole('region', { name: 'Trace signal theme flow' })).not.toBeNull();
    });

    it('keeps exactly one trace intelligence documentation action across the shell and page', async () => {
      renderSignalsPageWithShell();
      await screen.findByRole('region', { name: 'Trace signal theme flow' });

      expect(screen.getAllByRole('link', { name: 'Trace intelligence documentation' })).toHaveLength(1);
    });

    it('keeps the single agent visible in the selector', async () => {
      renderSignalsPage();

      expect((await screen.findByRole('combobox', { name: 'Agent' })).textContent).toContain('support-agent');
    });
  });

  describe('when the selected range is loading snapshots', () => {
    it('keeps the snapshot date control available', async () => {
      server.use(
        http.get(`${BASE_URL}/api/learning/entities`, () => HttpResponse.json(populatedThemeEntitiesResponse)),
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-snapshots`, async () => {
          await new Promise(() => {});
          return HttpResponse.json(themeSnapshotsResponse);
        }),
      );
      renderSignalsPage();

      expect(await screen.findByRole('button', { name: 'Last 7 days' })).not.toBeNull();
      expect(screen.getByRole('status', { name: 'Loading trace intelligence' })).not.toBeNull();
    });
  });

  describe('when the selected range fails to load snapshots', () => {
    it('keeps the snapshot date control available', async () => {
      server.use(
        http.get(`${BASE_URL}/api/learning/entities`, () => HttpResponse.json(populatedThemeEntitiesResponse)),
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-snapshots`, () =>
          HttpResponse.json({ error: 'Unable to load snapshots' }, { status: 500 }),
        ),
      );
      renderSignalsPage();

      expect(await screen.findByText('Unable to load trace signal flow.')).not.toBeNull();
      expect(screen.getByRole('button', { name: 'Last 7 days' })).not.toBeNull();
    });
  });

  describe('when the selected range has no snapshots', () => {
    it('keeps the snapshot date control available', async () => {
      server.use(
        http.get(`${BASE_URL}/api/learning/entities`, () => HttpResponse.json(populatedThemeEntitiesResponse)),
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-snapshots`, () =>
          HttpResponse.json(emptyThemeSnapshotsResponse),
        ),
      );
      renderSignalsPage();

      expect(await screen.findByText('Waiting for traces.')).not.toBeNull();
      expect(screen.getByRole('button', { name: 'Last 7 days' })).not.toBeNull();
    });
  });

  describe('when an eligible agent is loaded with the default snapshot range', () => {
    it('requests snapshots from the last seven days and labels the cutoff control', async () => {
      vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-07-27T12:00:00.000Z').getTime());
      const snapshotRequests: URL[] = [];
      server.use(
        http.get(`${BASE_URL}/api/learning/entities`, () => HttpResponse.json(populatedThemeEntitiesResponse)),
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-snapshots`, ({ request }) => {
          snapshotRequests.push(new URL(request.url));
          return HttpResponse.json(themeSnapshotsResponse);
        }),
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-flow`, () =>
          HttpResponse.json(themeFlowResponse),
        ),
      );

      renderSignalsPage();

      expect(await screen.findByRole('region', { name: 'Trace signal theme flow' })).not.toBeNull();
      expect(screen.getByText('Snapshot date')).not.toBeNull();
      expect(screen.getByRole('button', { name: 'Last 7 days' })).not.toBeNull();
      expect(snapshotRequests).toHaveLength(1);
      expect(snapshotRequests[0]?.searchParams.get('from')).toBe('2026-07-20T12:00:00.000Z');
      expect(snapshotRequests[0]?.searchParams.has('to')).toBe(false);
    });
  });

  describe('when the snapshot date preset changes', () => {
    it('requests and renders flows only for snapshots returned in the new range', async () => {
      vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-07-27T12:00:00.000Z').getTime());
      const flowSnapshotIds: string[] = [];
      server.use(
        http.get(`${BASE_URL}/api/learning/entities`, () => HttpResponse.json(populatedThemeEntitiesResponse)),
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-snapshots`, ({ request }) => {
          const from = new URL(request.url).searchParams.get('from');
          return HttpResponse.json(
            from === '2026-07-13T12:00:00.000Z' ? billingThemeSnapshotsResponse : themeSnapshotsResponse,
          );
        }),
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-flow`, ({ request }) => {
          const snapshotId = new URL(request.url).searchParams.get('snapshotId');
          if (!snapshotId) return HttpResponse.json({ error: 'Missing snapshot' }, { status: 400 });
          flowSnapshotIds.push(snapshotId);
          const snapshot = billingThemeSnapshotsResponse.snapshots.find(
            candidate => candidate.snapshotId === snapshotId,
          );
          return HttpResponse.json(snapshot ? { ...themeFlowResponse, snapshot } : themeFlowResponse);
        }),
      );
      renderSignalsPage();
      await screen.findByRole('region', { name: 'Trace signal theme flow' });

      fireEvent.click(screen.getByRole('button', { name: 'Last 7 days' }));
      fireEvent.click(await screen.findByText('Last 14 days'));

      await waitFor(() => expect(screen.getByRole('button', { name: 'Last 14 days' })).not.toBeNull());
      await waitFor(() => expect(flowSnapshotIds).toEqual(['snapshot-1', 'billing-snapshot-1', 'billing-snapshot-2']));
      expect(await screen.findByText(/Snapshot 2 of 2/)).not.toBeNull();
    });
  });

  describe('when a snapshot range changes with theme details open', () => {
    it('clears the range-local theme selection', async () => {
      server.use(
        http.get(`${BASE_URL}/api/learning/entities`, () => HttpResponse.json(populatedThemeEntitiesResponse)),
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-snapshots`, () =>
          HttpResponse.json(themeSnapshotsResponse),
        ),
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-flow`, () =>
          HttpResponse.json(drilldownThemeFlowResponse),
        ),
        http.get(`${BASE_URL}/api/learning/entities/support-agent/themes/:themeId`, () =>
          HttpResponse.json(themeDetailResponse),
        ),
        http.get(`${BASE_URL}/api/learning/entities/support-agent/themes/:themeId/examples`, () =>
          HttpResponse.json(firstThemeExamplesResponse),
        ),
        http.get(`${BASE_URL}/api/learning/entities/support-agent/themes/:themeId/history`, () =>
          HttpResponse.json(themeHistoryResponse),
        ),
      );
      renderSignalsPage();
      fireEvent.click(await screen.findByRole('button', { name: 'View theme details for Add transcript' }));
      await screen.findByRole('dialog', { name: 'Add transcript' });

      fireEvent.click(screen.getByRole('button', { name: 'Last 7 days' }));
      fireEvent.click(await screen.findByText('Last 24 hours'));

      await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Add transcript' })).toBeNull());
    });
  });

  describe('when a theme example is opened from the page', () => {
    it('reaches the trace insight view with a link to the full trace', async () => {
      server.use(
        http.get(`${BASE_URL}/api/learning/entities`, () => HttpResponse.json(populatedThemeEntitiesResponse)),
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-snapshots`, () =>
          HttpResponse.json(themeSnapshotsResponse),
        ),
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-flow`, () =>
          HttpResponse.json(drilldownThemeFlowResponse),
        ),
        http.get(`${BASE_URL}/api/learning/entities/support-agent/themes/:themeId`, () =>
          HttpResponse.json(themeDetailResponse),
        ),
        http.get(`${BASE_URL}/api/learning/entities/support-agent/themes/:themeId/examples`, () =>
          HttpResponse.json(firstThemeExamplesResponse),
        ),
        http.get(`${BASE_URL}/api/learning/entities/support-agent/themes/:themeId/history`, () =>
          HttpResponse.json(themeHistoryResponse),
        ),
        http.get(`${BASE_URL}/api/learning/traces/trace-1/summary`, () => HttpResponse.json(traceInsightResponse)),
      );
      renderSignalsPage();

      fireEvent.click(await screen.findByRole('button', { name: 'View theme details for Add transcript' }));
      await screen.findByRole('dialog', { name: 'Add transcript' });
      fireEvent.click(
        await screen.findByRole('button', { name: 'View trace insight for Add this transcript to my workspace.' }),
      );

      expect(await screen.findByText('Add a transcript to the workspace.')).not.toBeNull();
      expect(screen.getByRole('link', { name: 'Open full trace' }).getAttribute('href')).toBe('/traces/trace-1');
    });
  });

  describe('when a custom snapshot date range is applied', () => {
    it('requests snapshots with inclusive start and end timestamps', async () => {
      vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-07-27T12:00:00.000Z').getTime());
      const snapshotRequests: URL[] = [];
      server.use(
        http.get(`${BASE_URL}/api/learning/entities`, () => HttpResponse.json(populatedThemeEntitiesResponse)),
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-snapshots`, ({ request }) => {
          snapshotRequests.push(new URL(request.url));
          return HttpResponse.json(themeSnapshotsResponse);
        }),
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-flow`, () =>
          HttpResponse.json(themeFlowResponse),
        ),
      );
      renderSignalsPage();
      await screen.findByRole('region', { name: 'Trace signal theme flow' });

      fireEvent.click(screen.getByRole('button', { name: 'Last 7 days' }));
      fireEvent.click(await screen.findByText('Custom range...'));
      const endPanel = (await screen.findByText('End')).parentElement;
      if (!endPanel) throw new Error('Custom range end panel was not rendered');
      fireEvent.click(within(endPanel).getByRole('gridcell', { name: '25' }));
      fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

      const expectedFrom = new Date(2026, 6, 20, 0, 0).toISOString();
      const expectedTo = new Date(2026, 6, 25, 23, 59).toISOString();
      await waitFor(() => expect(snapshotRequests).toHaveLength(2));
      expect(snapshotRequests[1]?.searchParams.get('from')).toBe(expectedFrom);
      expect(snapshotRequests[1]?.searchParams.get('to')).toBe(expectedTo);
    });
  });

  describe('when a low-signal agent is returned before an eligible agent', () => {
    it('defaults to the first agent that can render a flow', async () => {
      server.use(
        http.get(`${BASE_URL}/api/learning/entities`, () => HttpResponse.json(lowSignalFirstThemeEntitiesResponse)),
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-snapshots`, () =>
          HttpResponse.json(themeSnapshotsResponse),
        ),
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-flow`, () =>
          HttpResponse.json(themeFlowResponse),
        ),
      );

      renderSignalsPage();

      expect((await screen.findByRole('combobox', { name: 'Agent' })).textContent).toContain('support-agent');
      expect(screen.queryByText('Not enough trace signal data yet')).toBeNull();
    });
  });

  describe('when multiple agents have different signal coverage', () => {
    beforeEach(() => {
      server.use(
        http.get(`${BASE_URL}/api/learning/entities`, () => HttpResponse.json(multiAgentThemeEntitiesResponse)),
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-snapshots`, () =>
          HttpResponse.json(themeSnapshotsResponse),
        ),
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-flow`, () =>
          HttpResponse.json(themeFlowResponse),
        ),
      );
    });

    it('lists every agent in the always-visible selector', async () => {
      renderSignalsPage();

      const selector = await screen.findByRole('combobox', { name: 'Agent' });
      fireEvent.click(selector);

      expect(await screen.findByRole('option', { name: 'support-agent' })).not.toBeNull();
      expect(screen.getByRole('option', { name: 'triage-agent' })).not.toBeNull();
    });

    it('explains why the selected agent cannot render a flow', async () => {
      renderSignalsPage();

      fireEvent.click(await screen.findByRole('combobox', { name: 'Agent' }));
      const triageAgent = await screen.findByRole('option', { name: 'triage-agent' });
      fireEvent.pointerDown(triageAgent, { pointerType: 'mouse' });
      fireEvent.click(triageAgent, { detail: 1 });

      expect(await screen.findByText('Not enough trace signal data yet')).not.toBeNull();
      expect(screen.getByText('Available trace signals: Goal')).not.toBeNull();
      expect(screen.getByRole('combobox', { name: 'Agent' })).not.toBeNull();
    });
  });

  describe('when switching between eligible agents', () => {
    it("loads the selected agent's latest snapshot", async () => {
      let billingFlowSnapshotId: string | null = null;
      server.use(
        http.get(`${BASE_URL}/api/learning/entities`, () => HttpResponse.json(multiEligibleThemeEntitiesResponse)),
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-snapshots`, () =>
          HttpResponse.json(themeSnapshotsResponse),
        ),
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-flow`, () =>
          HttpResponse.json(themeFlowResponse),
        ),
        http.get(`${BASE_URL}/api/learning/entities/billing-agent/theme-snapshots`, () =>
          HttpResponse.json(billingThemeSnapshotsResponse),
        ),
        http.get(`${BASE_URL}/api/learning/entities/billing-agent/theme-flow`, ({ request }) => {
          billingFlowSnapshotId = new URL(request.url).searchParams.get('snapshotId');
          return HttpResponse.json({
            ...themeFlowResponse,
            snapshot: billingThemeSnapshotsResponse.snapshots[1],
          });
        }),
      );
      renderSignalsPage();
      fireEvent.click(await screen.findByRole('combobox', { name: 'Agent' }));
      const billingAgent = await screen.findByRole('option', { name: 'billing-agent' });

      fireEvent.pointerDown(billingAgent, { pointerType: 'mouse' });
      fireEvent.click(billingAgent, { detail: 1 });

      expect(await screen.findByText('Snapshot 2/2 · Jul 8–15, 2026 · 30 traces')).not.toBeNull();
      expect(billingFlowSnapshotId).toBe('billing-snapshot-2');
    });
  });

  describe('when an agent has no theme snapshots', () => {
    it('shows that the analysis is waiting for traces', async () => {
      server.use(
        http.get(`${BASE_URL}/api/learning/entities`, () => HttpResponse.json(populatedThemeEntitiesResponse)),
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-snapshots`, () =>
          HttpResponse.json({ snapshots: [] }),
        ),
      );

      renderSignalsPage();

      expect(await screen.findByText('Waiting for traces.')).not.toBeNull();
    });
  });
});
