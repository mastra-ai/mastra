// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TopicTraceSummary } from '@mastra/playground-ui';
import TopicsPage from '..';

const { resolvedTraceId, resolvedSpanId } = vi.hoisted(() => ({
  resolvedTraceId: 'resolved-trace-1',
  resolvedSpanId: 'resolved-span-1',
}));

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

afterEach(() => cleanup());

describe('TopicsPage', () => {
  it('renders full-width topic sections with subtopic cards', () => {
    renderTopicsPage();

    expect(screen.queryByTestId('topics-sidebar')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Customer Support' })).not.toBeNull();
    expect(screen.getByRole('heading', { name: 'Research' })).not.toBeNull();
    expect(screen.getByRole('button', { name: /Refunds/ })).not.toBeNull();
    expect(screen.getByRole('button', { name: /Shipping/ })).not.toBeNull();
  });

  it('uses route params for the focused subtopic exploration page', () => {
    renderTopicsPage('/topics/refunds');

    expect(screen.queryByTestId('topics-sidebar')).toBeNull();
    expect(screen.queryByText('Back to topics')).toBeNull();
    expect(screen.getByText('Refunds')).not.toBeNull();
    expect(screen.getByText('Refund requests, policy checks, and payment reversals.')).not.toBeNull();
    expect(screen.getByText('summary:2')).not.toBeNull();
    expect(screen.getByText('trace:none')).not.toBeNull();
  });

  it('navigates from cards to subtopic and trace routes', () => {
    renderTopicsPage();

    fireEvent.click(screen.getByRole('button', { name: /Refunds/ }));
    expect(screen.getByTestId('location').textContent).toBe('/topics/refunds');

    fireEvent.click(screen.getByRole('button', { name: 'Select trace' }));
    expect(screen.getByTestId('location').textContent).toBe(`/topics/refunds/traces/${resolvedTraceId}`);
    expect(screen.getByText(`details:${resolvedTraceId}`)).not.toBeNull();
    expect(screen.getByText(`span:${resolvedSpanId}`)).not.toBeNull();
  });

  it('closes the trace panel back to the selected subtopic page', () => {
    renderTopicsPage(`/topics/refunds/traces/${resolvedTraceId}`);

    expect(screen.getByText('summary:2')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Close trace' }));
    expect(screen.getByTestId('location').textContent).toBe('/topics/refunds');
  });
});
