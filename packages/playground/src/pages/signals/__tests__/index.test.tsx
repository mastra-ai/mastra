// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, Outlet, Route, Routes, useLocation } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TopicTraceSummary } from '@mastra/playground-ui';
import SignalsOverviewPage, { SignalDetailsPage, SignalTraceIdPage } from '..';

const { resolvedTraceId, resolvedSpanId, navigate } = vi.hoisted(() => ({
  resolvedTraceId: 'resolved-trace-1',
  resolvedSpanId: 'resolved-span-1',
  navigate: vi.fn(),
}));

vi.mock('react-router', async importOriginal => {
  const actual = await importOriginal<typeof import('react-router')>();

  return {
    ...actual,
    useNavigate: () => navigate,
  };
});

vi.mock('@mastra/playground-ui', async importOriginal => {
  const actual = await importOriginal<typeof import('@mastra/playground-ui')>();

  return {
    ...actual,
    useTraces: () => ({ data: { spans: [{ traceId: resolvedTraceId, spanId: resolvedSpanId }] } }),
    TopicsLayout: ({ sidebar, children, tracePanel }: { sidebar?: ReactNode; children?: ReactNode; tracePanel?: ReactNode }) => (
      <div>
        {sidebar ? <div data-testid="signals-sidebar-slot">{sidebar}</div> : null}
        <div data-testid="signals-main">{children}</div>
        <div data-testid="signals-trace-panel">{tracePanel}</div>
      </div>
    ),
    TopicTraceSummaryList: ({
      traces,
      selectedTraceId,
      onTraceSelect,
    }: {
      traces: TopicTraceSummary[];
      selectedTraceId?: string | null;
      onTraceSelect: (trace: TopicTraceSummary) => void;
    }) => (
      <div>
        <span>summary:{traces.length}</span>
        <span>trace:{selectedTraceId ?? 'none'}</span>
        <span>first-trace:{traces[0]?.name}</span>
        <button type="button" onClick={() => onTraceSelect(traces[0])}>
          Select trace
        </button>
      </div>
    ),
    ScatterPlotChart: ({
      data,
      xKey,
      yKey,
      height,
      className,
    }: {
      data: Record<string, unknown>[];
      xKey: string;
      yKey: string;
      height?: unknown;
      className?: string;
    }) => {
      const clusters = Array.from(new Set(data.map(point => point.cluster))).join(',');

      return (
        <div data-testid="scatter-plot-chart" data-height={String(height)} data-clusters={clusters} className={className}>
          chart:{data.length}:{xKey}:{yKey}
        </div>
      );
    },
    TopicTraceDetailsPanel: ({
      traceId,
      selectedSpanId,
      onClose,
    }: {
      traceId: string | null;
      selectedSpanId?: string | null;
      onClose: () => void;
    }) =>
      traceId ? (
        <aside aria-label="Trace details">
          <span>details:{traceId}</span>
          <span>span:{selectedSpanId ?? 'none'}</span>
          <button type="button" onClick={onClose}>
            Close trace
          </button>
        </aside>
      ) : null,
  };
});

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

function SignalsTestShell() {
  return (
    <>
      <Outlet />
      <LocationProbe />
    </>
  );
}

function renderSignalsPage(initialEntry = '/signals') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/signals" element={<SignalsTestShell />}>
          <Route index element={<SignalsOverviewPage />} />
          <Route path=":signalId" element={<SignalDetailsPage />} />
          <Route path=":signalId/traces/:traceId" element={<SignalTraceIdPage />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  navigate.mockClear();
});

describe('Signals pages', () => {
  it('renders signal sections with non-clickable facet metric cards', () => {
    renderSignalsPage();

    expect(screen.queryByTestId('signals-sidebar-slot')).toBeNull();
    expect(screen.getByRole('navigation', { name: 'Signals' })).not.toBeNull();
    expect(screen.getByRole('heading', { name: 'Tasks' })).not.toBeNull();
    expect(screen.getByRole('heading', { name: 'Sentiment' })).not.toBeNull();
    expect(screen.getByRole('heading', { name: 'Issue' })).not.toBeNull();
    expect(screen.getByRole('heading', { name: 'Severity' })).not.toBeNull();
    expect(screen.getByRole('heading', { name: 'Refunds' })).not.toBeNull();
    expect(screen.getByRole('heading', { name: 'Shipping' })).not.toBeNull();
    expect(screen.getByRole('heading', { name: 'Account updates' })).not.toBeNull();
    expect(screen.getByRole('heading', { name: 'Subscription changes' })).not.toBeNull();
    expect(screen.getByRole('heading', { name: 'Negative feedback' })).not.toBeNull();
    expect(screen.getByRole('heading', { name: 'Positive feedback' })).not.toBeNull();
    expect(screen.getByRole('heading', { name: 'Uncertain feedback' })).not.toBeNull();
    expect(screen.getByRole('heading', { name: 'Revenue analysis' })).not.toBeNull();
    expect(screen.queryByRole('button', { name: /Refunds/ })).toBeNull();
    expect(screen.getAllByText('Trace share').length).toBeGreaterThan(0);
    expect(screen.getByRole('progressbar', { name: 'Refunds trace share' })).not.toBeNull();
    expect(screen.getByRole('progressbar', { name: 'Refunds trace share' }).getAttribute('aria-valuenow')).toBe('33');
    expect(screen.getByRole('progressbar', { name: 'Shipping trace share' }).getAttribute('aria-valuenow')).toBe('17');
    expect(screen.getByRole('progressbar', { name: 'Account updates trace share' }).getAttribute('aria-valuenow')).toBe('33');
    expect(screen.getByRole('progressbar', { name: 'Subscription changes trace share' }).getAttribute('aria-valuenow')).toBe('17');
    expect(screen.getAllByText('33%').length).toBeGreaterThan(0);
    expect(screen.getAllByText('17%').length).toBeGreaterThan(0);
    expect(screen.getAllByText('2 traces').length).toBeGreaterThan(0);
    expect(screen.getAllByText('1 trace').length).toBeGreaterThan(0);
    expect(screen.queryByTestId('scatter-plot-chart')).toBeNull();
  });

  it('navigates from the signal section CTA to the owning signal URL', () => {
    renderSignalsPage();

    fireEvent.click(screen.getAllByRole('button', { name: 'See details' })[0]);

    expect(navigate).toHaveBeenCalledWith('/signals/tasks', { viewTransition: true });
  });

  it('keeps facet selection local on the focused signal page', () => {
    renderSignalsPage('/signals/tasks');

    expect(screen.getAllByRole('heading', { name: 'Tasks' }).length).toBeGreaterThan(0);
    expect(screen.getByText('summary:2')).not.toBeNull();
    expect(screen.getByText('first-trace:Refund eligibility check')).not.toBeNull();
    expect(screen.getByTestId('location').textContent).toBe('/signals/tasks');

    fireEvent.click(screen.getByRole('button', { name: /Shipping/ }));

    expect(screen.getByText('summary:1')).not.toBeNull();
    expect(screen.getByText('first-trace:Track delayed package')).not.toBeNull();
    expect(navigate).not.toHaveBeenCalled();
    expect(screen.getByTestId('location').textContent).toBe('/signals/tasks');
  });

  it('keeps the trace list facet sidebar inside the top-level trace list tab', () => {
    renderSignalsPage('/signals/tasks');

    expect(screen.getByRole('tab', { name: 'Trace list' })).not.toBeNull();
    expect(screen.getByRole('tab', { name: 'Chart' })).not.toBeNull();
    expect(screen.getByRole('complementary', { name: 'Signal facets' })).not.toBeNull();
    expect(screen.getByText('summary:2')).not.toBeNull();
    expect(screen.getByText('first-trace:Refund eligibility check')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Shipping/ }));

    expect(screen.getByText('summary:1')).not.toBeNull();
    expect(screen.getByText('first-trace:Track delayed package')).not.toBeNull();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('renders chart as a top-level tab with all facets selected as filters by default', () => {
    renderSignalsPage('/signals/tasks');

    fireEvent.click(screen.getByRole('tab', { name: 'Chart' }));

    expect(screen.getByLabelText('Chart facet filters')).not.toBeNull();
    expect(screen.getByLabelText('Toggle Refunds')).not.toBeNull();
    expect(screen.getByLabelText('Toggle Shipping')).not.toBeNull();
    expect(screen.getByLabelText('Toggle Account updates')).not.toBeNull();
    expect(screen.getByLabelText('Toggle Subscription changes')).not.toBeNull();
    expect(screen.getByTestId('scatter-plot-chart')).not.toBeNull();
    expect(screen.getByText('chart:320:duration:spans')).not.toBeNull();
    expect(screen.getByTestId('scatter-plot-chart').dataset.clusters).toBe('Fast paths,Standard paths,Complex paths');
    expect(screen.getByTestId('scatter-plot-chart').dataset.height).toBe('100%');
    expect(screen.getByTestId('scatter-plot-chart').className).toContain('h-full');

    fireEvent.click(screen.getByLabelText('Toggle Shipping'));

    expect(screen.getByText('chart:240:duration:spans')).not.toBeNull();
  });

  it('opens trace details on the dedicated trace route without preselecting span details', () => {
    renderSignalsPage('/signals/tasks');

    fireEvent.click(screen.getByRole('button', { name: 'Select trace' }));
    expect(navigate).toHaveBeenCalledWith(`/signals/tasks/traces/${resolvedTraceId}`);

    cleanup();
    renderSignalsPage(`/signals/tasks/traces/${resolvedTraceId}`);

    expect(screen.getByText('details:resolved-trace-1')).not.toBeNull();
    expect(screen.getByText('span:none')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Close trace' }));
    expect(navigate).toHaveBeenCalledWith('/signals/tasks');
  });
});
