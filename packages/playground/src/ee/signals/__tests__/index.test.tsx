// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, MemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import SignalsOverviewPage from '..';
import { navHandleWithChildren } from '../../../lib/nav';
import { RouteHeader } from '../../../lib/route-header/route-header';
import { SignalsEntityCrumb } from '../signals-entity-crumb';
import {
  allThemePathsResponse,
  drilldownThemeFlowResponse,
  firstThemeExamplesResponse,
  themeDetailResponse,
  themeHistoryResponse,
  traceInsightResponse,
} from './fixtures/theme-drilldown';
import {
  billingThemeSnapshotsResponse,
  customSignalProgressResponse,
  customThemeEntitiesResponse,
  customThemeFlowResponse,
  customThemeSnapshotsResponse,
  emptyThemeEntitiesResponse,
  emptyThemeSnapshotsResponse,
  lowSignalFirstThemeEntitiesResponse,
  multiAgentThemeEntitiesResponse,
  multiEligibleThemeEntitiesResponse,
  populatedThemeEntitiesResponse,
  processingProgressResponse,
  themeFlowResponse,
  themeSnapshotsResponse,
} from './fixtures/theme-flow';
import { server } from '@/test/msw-server';

const BASE_URL = window.location.origin;

// Chart nodes only render once the responsive container observes a real size.
class ChartResizeObserver implements ResizeObserver {
  constructor(private readonly callback: ResizeObserverCallback) {}

  observe(target: Element) {
    const size = { blockSize: 680, inlineSize: 800 };
    const entry = {
      target,
      contentRect: new DOMRectReadOnly(0, 0, 800, 680),
      borderBoxSize: [size],
      contentBoxSize: [size],
      devicePixelContentBoxSize: [size],
    } satisfies ResizeObserverEntry;
    this.callback([entry], this);
  }

  unobserve() {}

  disconnect() {}
}

function renderSignalsPage(initialEntry = '/') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
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
        handle: navHandleWithChildren('/intelligence', [
          { id: 'signals-agent', Component: SignalsEntityCrumb, heading: 'Agent' },
        ]),
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

function headerAgentSelector() {
  return within(screen.getByRole('navigation', { name: 'Breadcrumb' })).getByRole('combobox');
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', ChartResizeObserver);
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(800);
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(680);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('Trace Intelligence page', () => {
  describe('when the entities request is pending', () => {
    it('shows the Trace Intelligence loading state', async () => {
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

      expect(await screen.findByText('Unable to load trace signal entities.')).not.toBeNull();
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

      renderSignalsPageWithShell();

      expect(await screen.findByText('Unable to load trace signal entities.')).not.toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

      await waitFor(() => expect(headerAgentSelector().textContent).toContain('support-agent'));
      expect(attempts).toBe(2);
    });
  });

  describe('when no Agent Learning entities exist', () => {
    it('shows that Trace Intelligence is collecting traces', async () => {
      server.use(http.get(`${BASE_URL}/api/learning/entities`, () => HttpResponse.json(emptyThemeEntitiesResponse)));

      renderSignalsPage();

      expect(await screen.findByText('Collecting traces for Trace Intelligence.')).not.toBeNull();
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

    it('shows the snapshot summary under the timeline instead of a page header', async () => {
      renderSignalsPage();

      expect(await screen.findByTestId('snapshot-summary')).not.toBeNull();
      expect(screen.queryByRole('heading', { name: 'Understand what drives every agent interaction' })).toBeNull();
    });

    it('exposes the theme flow as a named region', async () => {
      renderSignalsPage();

      expect(await screen.findByRole('region', { name: 'Trace signal theme flow' })).not.toBeNull();
    });

    it('requests signals in processing order: goal, sentiment, behavior, outcome', async () => {
      const snapshotSignalNames: Array<string | undefined> = [];
      server.use(
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-snapshots`, ({ request }) => {
          snapshotSignalNames.push(new URL(request.url).searchParams.get('signalNames') ?? undefined);
          return HttpResponse.json(themeSnapshotsResponse);
        }),
      );

      renderSignalsPage();

      await screen.findByRole('region', { name: 'Trace signal theme flow' });
      expect(snapshotSignalNames[0]).toBe('goal,sentiment,behavior,outcome');
    });

    it('keeps exactly one Trace intelligence documentation action across the shell and page', async () => {
      renderSignalsPageWithShell();
      await screen.findByRole('region', { name: 'Trace signal theme flow' });

      expect(screen.getAllByRole('link', { name: 'Trace intelligence documentation' })).toHaveLength(1);
    });

    it('keeps the single agent visible in the header selector', async () => {
      renderSignalsPageWithShell();

      await waitFor(() => expect(headerAgentSelector().textContent).toContain('support-agent'));
    });

    it('shows the agent selector in the breadcrumb instead of a page-level control row', async () => {
      renderSignalsPageWithShell();
      await screen.findByRole('region', { name: 'Trace signal theme flow' });

      const main = screen.getByRole('main');
      expect(within(main).queryByRole('combobox')).toBeNull();
      expect(screen.queryByText('Snapshot date')).toBeNull();
      expect(within(main).getByRole('button', { name: 'Last 7 days' })).not.toBeNull();
    });
  });

  describe('when an agent has custom and pending trace signals', () => {
    beforeEach(() => {
      server.use(
        http.get(`${BASE_URL}/api/learning/entities`, () => HttpResponse.json(customThemeEntitiesResponse)),
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-snapshots`, () =>
          HttpResponse.json(customThemeSnapshotsResponse),
        ),
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-flow`, () =>
          HttpResponse.json(customThemeFlowResponse),
        ),
        http.get(`${BASE_URL}/api/learning/entities/support-agent/progress`, () =>
          HttpResponse.json(customSignalProgressResponse),
        ),
      );
    });

    it('renders the ready custom signal in catalog order', async () => {
      renderSignalsPage();

      const headers = await screen.findAllByTestId('signal-column-header');
      expect(headers.map(header => header.textContent)).toEqual(['GOAL', 'TOOL OPERATIONS', 'OUTCOME']);
    });

    it('keeps collecting and processing custom signals visible with real counts', async () => {
      renderSignalsPage();

      const pending = await screen.findByRole('list', { name: 'Pending trace signals' });
      expect(within(pending).getByText('Handoff Quality')).not.toBeNull();
      expect(within(pending).getByText('0 generated · 0 embedded')).not.toBeNull();
      expect(within(pending).getByText('Resolution Detail')).not.toBeNull();
      expect(within(pending).getByText('31 generated · 19 embedded')).not.toBeNull();
      expect(within(pending).queryByText('Legacy Risk')).toBeNull();
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
        http.get(`${BASE_URL}/api/learning/entities/support-agent/progress`, () =>
          HttpResponse.json(processingProgressResponse),
        ),
      );
      renderSignalsPage();

      expect(await screen.findByText('No Trace Intelligence themes in this date range.')).not.toBeNull();
      expect(screen.getByRole('button', { name: 'Last 7 days' })).not.toBeNull();
    });
  });

  describe('when an eligible agent is loaded with the default snapshot range', () => {
    it('requests snapshots from the last seven days without a snapshot date label', async () => {
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
      expect(screen.queryByText('Snapshot date')).toBeNull();
      expect(screen.getByRole('button', { name: 'Last 7 days' })).not.toBeNull();
      expect(snapshotRequests).toHaveLength(1);
      expect(snapshotRequests[0]?.searchParams.get('from')).toBe('2026-07-20T12:00:00.000Z');
      expect(snapshotRequests[0]?.searchParams.has('to')).toBe(false);
    });
  });

  describe('when the page loads with a snapshot date query parameter', () => {
    it('restores the selected range and requests snapshots for it', async () => {
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

      renderSignalsPage('/?datePreset=last-14d');

      expect(await screen.findByRole('button', { name: 'Last 14 days' })).not.toBeNull();
      await waitFor(() => expect(snapshotRequests).toHaveLength(1));
      expect(snapshotRequests[0]?.searchParams.get('from')).toBe('2026-07-13T12:00:00.000Z');
    });
  });

  describe('when the page loads with custom date query parameters', () => {
    it('restores the custom range and requests snapshots for it', async () => {
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

      renderSignalsPage('/?datePreset=custom&dateFrom=2026-07-01T00:00:00.000Z&dateTo=2026-07-15T00:00:00.000Z');

      expect(await screen.findByRole('region', { name: 'Trace signal theme flow' })).not.toBeNull();
      await waitFor(() => expect(snapshotRequests).toHaveLength(1));
      expect(snapshotRequests[0]?.searchParams.get('from')).toBe('2026-07-01T00:00:00.000Z');
      expect(snapshotRequests[0]?.searchParams.get('to')).toBe('2026-07-15T00:00:00.000Z');
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
      expect(await screen.findByRole('button', { name: /Snapshot 2 of 2/ })).not.toBeNull();
    });
  });

  describe('when a snapshot range changes with theme details open', () => {
    it('keeps the selected theme open', async () => {
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
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-paths`, () =>
          HttpResponse.json(allThemePathsResponse),
        ),
      );
      renderSignalsPage();
      fireEvent.click(await screen.findByRole('button', { name: /Add transcript.+2 traces \(67%\)/ }));
      await screen.findByRole('dialog', { name: 'Add transcript' });

      fireEvent.click(screen.getByRole('button', { name: 'Last 7 days' }));
      fireEvent.click(await screen.findByText('Last 24 hours'));

      expect(await screen.findByRole('dialog', { name: 'Add transcript' })).not.toBeNull();
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
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-paths`, () =>
          HttpResponse.json(allThemePathsResponse),
        ),
        http.get(`${BASE_URL}/api/learning/traces/trace-1/summary`, () => HttpResponse.json(traceInsightResponse)),
      );
      renderSignalsPage();

      fireEvent.click(await screen.findByRole('button', { name: /Add transcript.+2 traces \(67%\)/ }));
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
      // Freeze the clock so the calendar (which reads `new Date()`, not `Date.now()`)
      // always opens on the same month; fake only `Date` so timers used by
      // waitFor/React Query keep running.
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2026-07-27T12:00:00.000Z'));
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

  describe('when a low-trace-signal agent is returned before an eligible agent', () => {
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

      renderSignalsPageWithShell();

      await waitFor(() => expect(headerAgentSelector().textContent).toContain('support-agent'));
      expect(screen.queryByText('Not enough trace signal data yet')).toBeNull();
    });
  });

  describe('when multiple agents have different trace signal coverage', () => {
    beforeEach(() => {
      server.use(
        http.get(`${BASE_URL}/api/learning/entities`, () => HttpResponse.json(multiAgentThemeEntitiesResponse)),
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-snapshots`, () =>
          HttpResponse.json(themeSnapshotsResponse),
        ),
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-flow`, () =>
          HttpResponse.json(themeFlowResponse),
        ),
        http.get(`${BASE_URL}/api/learning/entities/triage-agent/progress`, () =>
          HttpResponse.json(processingProgressResponse),
        ),
      );
    });

    it('lists every agent in the header selector', async () => {
      renderSignalsPageWithShell();
      await waitFor(() => expect(headerAgentSelector().textContent).toContain('support-agent'));

      fireEvent.click(headerAgentSelector());

      expect(await screen.findByRole('option', { name: 'support-agent' })).not.toBeNull();
      expect(screen.getByRole('option', { name: 'triage-agent' })).not.toBeNull();
    });

    it('explains why the selected agent cannot render a flow', async () => {
      renderSignalsPageWithShell();
      await waitFor(() => expect(headerAgentSelector().textContent).toContain('support-agent'));

      fireEvent.click(headerAgentSelector());
      const triageAgent = await screen.findByRole('option', { name: 'triage-agent' });
      fireEvent.pointerDown(triageAgent, { pointerType: 'mouse' });
      fireEvent.click(triageAgent, { detail: 1 });

      expect(await screen.findByText('Analyzing traces for Trace Intelligence.')).not.toBeNull();
      expect(screen.getByText('87')).not.toBeNull();
      expect(screen.getByText('1 of 4')).not.toBeNull();
      expect(headerAgentSelector().textContent).toContain('triage-agent');
      expect(screen.queryByText('Snapshot date')).toBeNull();
      expect(screen.queryByRole('button', { name: 'Last 7 days' })).toBeNull();
    });
  });

  describe('when switching between eligible agents', () => {
    it("loads the selected agent's first snapshot", async () => {
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
          const snapshotId = new URL(request.url).searchParams.get('snapshotId');
          const snapshot = billingThemeSnapshotsResponse.snapshots.find(item => item.snapshotId === snapshotId);
          if (!snapshot) return HttpResponse.json({ error: 'Unknown snapshot' }, { status: 400 });
          return HttpResponse.json({ ...themeFlowResponse, snapshot });
        }),
      );
      renderSignalsPageWithShell();
      await waitFor(() => expect(headerAgentSelector().textContent).toContain('support-agent'));
      fireEvent.click(headerAgentSelector());
      const billingAgent = await screen.findByRole('option', { name: 'billing-agent' });

      fireEvent.pointerDown(billingAgent, { pointerType: 'mouse' });
      fireEvent.click(billingAgent, { detail: 1 });

      expect(await screen.findByText('Snapshot 1/2 · Jul 1–8, 2026 · 20 traces')).not.toBeNull();
    });
  });

  describe('when an agent has no theme snapshots', () => {
    it('shows that the analysis is waiting for traces', async () => {
      server.use(
        http.get(`${BASE_URL}/api/learning/entities`, () => HttpResponse.json(populatedThemeEntitiesResponse)),
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-snapshots`, () =>
          HttpResponse.json({ snapshots: [] }),
        ),
        http.get(`${BASE_URL}/api/learning/entities/support-agent/progress`, () =>
          HttpResponse.json(processingProgressResponse),
        ),
      );

      renderSignalsPage();

      expect(await screen.findByText('No Trace Intelligence themes in this date range.')).not.toBeNull();
    });
  });
});
