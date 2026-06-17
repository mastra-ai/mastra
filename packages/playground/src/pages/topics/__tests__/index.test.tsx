// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TopicTraceSummary } from '@mastra/playground-ui';
import TopicsPage from '..';

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
        {sidebar ? <div data-testid="topics-sidebar">{sidebar}</div> : null}
        <div data-testid="topics-main">{children}</div>
        <div data-testid="topics-trace-panel">{tracePanel}</div>
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
        <button type="button" onClick={() => onTraceSelect(traces[0])}>
          Select trace
        </button>
      </div>
    ),
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

function renderTopicsPage(initialEntry = '/topics') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/topics" element={<><TopicsPage /><LocationProbe /></>}>
          <Route index />
          <Route path=":topicId" />
          <Route path=":topicId/traces/:traceId" />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  navigate.mockClear();
});

describe('TopicsPage', () => {
  it('renders full-width topic sections with subtopic cards', () => {
    renderTopicsPage();

    expect(screen.queryByTestId('topics-sidebar')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Customer Support' })).not.toBeNull();
    expect(screen.getByRole('heading', { name: 'Research' })).not.toBeNull();
    const refundsCard = screen.getByRole('button', { name: /Refunds/ });
    const refundsCardPill = refundsCard.querySelector<HTMLElement>('.rounded-full');
    expect(refundsCardPill?.style.viewTransitionName).toBe('topics-refunds-pill');
    expect(screen.getByRole('heading', { name: 'Refunds' }).style.viewTransitionName).toBe('topics-refunds-title');
    expect(screen.getByText('Refund requests, policy checks, and payment reversals.').style.viewTransitionName).toBe(
      'topics-refunds-description',
    );
    expect(screen.getByRole('heading', { name: 'Shipping' }).style.viewTransitionName).toBe('topics-shipping-title');
  });

  it('uses route params for the focused subtopic exploration page', () => {
    renderTopicsPage('/topics/refunds');

    expect(screen.queryByTestId('topics-sidebar')).toBeNull();
    expect(screen.queryByText('Back to topics')).toBeNull();
    const focusedRefundsPill = screen.getByRole('heading', { name: 'Refunds' }).closest('header')?.querySelector<HTMLElement>('.rounded-full');
    expect(focusedRefundsPill?.style.viewTransitionName).toBe('topics-refunds-pill');
    expect(screen.getByRole('heading', { name: 'Refunds' }).style.viewTransitionName).toBe('topics-refunds-title');
    expect(screen.getByText('Refund requests, policy checks, and payment reversals.').style.viewTransitionName).toBe(
      'topics-refunds-description',
    );
    expect(screen.getByText('summary:2')).not.toBeNull();
    expect(screen.getByText('trace:none')).not.toBeNull();
  });

  it('navigates from cards to subtopic routes with view transitions', () => {
    renderTopicsPage();

    fireEvent.click(screen.getByRole('button', { name: /Refunds/ }));
    expect(navigate).toHaveBeenCalledWith('/topics/refunds', { viewTransition: true });
  });

  it('navigates from focused subtopic to trace routes without view transitions', () => {
    renderTopicsPage('/topics/refunds');

    fireEvent.click(screen.getByRole('button', { name: 'Select trace' }));
    expect(navigate).toHaveBeenCalledWith(`/topics/refunds/traces/${resolvedTraceId}`);
  });

  it('opens trace details without selecting a span by default', () => {
    renderTopicsPage(`/topics/refunds/traces/${resolvedTraceId}`);

    expect(screen.getByText('summary:2')).not.toBeNull();
    expect(screen.getByText('span:none')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Close trace' }));
    expect(navigate).toHaveBeenCalledWith('/topics/refunds');
  });
});
