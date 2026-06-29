// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import type * as ReactRouter from 'react-router';
import { MemoryRouter, Outlet, Route, Routes, useLocation } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SignalsOverviewPage, { SignalDetailsPage, SignalTraceIdPage } from '..';
import { SignalCrumb } from '../signal-crumb';

const { navigate } = vi.hoisted(() => ({
  navigate: vi.fn(),
}));

vi.mock('react-router', async importOriginal => {
  const actual = await importOriginal<typeof ReactRouter>();

  return {
    ...actual,
    useNavigate: () => navigate,
  };
});

vi.mock('@mastra/playground-ui/ee/signals/components/signal-details-utils', () => ({
  getSignalName: (signalId: string) => (signalId === 'tasks' ? 'Tasks' : signalId),
}));

vi.mock('@mastra/playground-ui/ee/signals/components/signals-overview-page', () => ({
  SignalsOverviewPage: ({ onSignalSelect }: { onSignalSelect: (signal: { id: string }) => void }) => (
    <button type="button" onClick={() => onSignalSelect({ id: 'tasks' })}>
      Select signal
    </button>
  ),
}));

vi.mock('@mastra/playground-ui/ee/signals/components/signal-details-page', () => ({
  SignalDetailsPage: ({
    signalId,
    selectedTraceId,
    tracePanel,
    onTraceSelect,
  }: {
    signalId?: string;
    selectedTraceId: string | null;
    tracePanel?: ReactNode;
    onTraceSelect: (signalId: string, traceId: string) => void;
  }) => (
    <div>
      <span>signal:{signalId}</span>
      <span>trace:{selectedTraceId ?? 'none'}</span>
      <button type="button" onClick={() => onTraceSelect(signalId ?? 'missing', 'resolved-trace-1')}>
        Select trace
      </button>
      {tracePanel}
    </div>
  ),
  SignalTraceDetailsPanel: ({
    traceId,
    selectedSpanId,
    onSpanSelect,
    onClose,
  }: {
    traceId: string;
    selectedSpanId: string | null;
    onSpanSelect: (spanId: string | null) => void;
    onClose: () => void;
  }) => (
    <aside aria-label="Trace details">
      <span>details:{traceId}</span>
      <span>span:{selectedSpanId ?? 'none'}</span>
      <button type="button" onClick={() => onSpanSelect('span-1')}>
        Select span
      </button>
      <button type="button" onClick={onClose}>
        Close trace
      </button>
    </aside>
  ),
}));

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

describe('Signals page wrappers', () => {
  it('navigates from the overview component callback to the signal route', () => {
    renderSignalsPage();

    fireEvent.click(screen.getByRole('button', { name: 'Select signal' }));

    expect(navigate).toHaveBeenCalledWith('/signals/tasks', { viewTransition: true });
  });

  it('passes the route signal param to the reusable details page', () => {
    renderSignalsPage('/signals/tasks');

    expect(screen.getByText('signal:tasks')).not.toBeNull();
    expect(screen.getByText('trace:none')).not.toBeNull();
  });

  it('navigates from reusable trace selection callbacks to the trace route', () => {
    renderSignalsPage('/signals/tasks');

    fireEvent.click(screen.getByRole('button', { name: 'Select trace' }));

    expect(navigate).toHaveBeenCalledWith('/signals/tasks/traces/resolved-trace-1');
  });

  it('passes trace route params into the reusable details and trace panel components', () => {
    renderSignalsPage('/signals/tasks/traces/trace-1');

    expect(screen.getByText('signal:tasks')).not.toBeNull();
    expect(screen.getByText('trace:trace-1')).not.toBeNull();
    expect(screen.getByText('details:trace-1')).not.toBeNull();
    expect(screen.getByText('span:none')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Close trace' }));
    expect(navigate).toHaveBeenCalledWith('/signals/tasks');
  });

  it('renders signal breadcrumbs from the playground-ui EE boundary', () => {
    render(
      <MemoryRouter initialEntries={['/signals/tasks']}>
        <Routes>
          <Route path="/signals/:signalId" element={<SignalCrumb />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('Tasks')).not.toBeNull();
  });
});
