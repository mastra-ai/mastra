// @vitest-environment jsdom
import '@/test/inert-resize-observer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render as renderUI } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TraceDataPanelView } from '../trace-data-panel-view';
import type { TraceDataPanelViewProps } from '../trace-data-panel-view';
import { rootSpanFixture } from './fixtures/trace-data-panel-view';

let queryClient: QueryClient;
beforeEach(() => {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
afterEach(() => {
  cleanup();
  queryClient.clear();
  localStorage.clear();
});

const render = (ui: ReactNode) =>
  renderUI(ui, {
    wrapper: ({ children }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>,
  });

const withEntityType = (entityType: string) => rootSpanFixture.map(span => ({ ...span, entityType }));

const props = (entityType: string): TraceDataPanelViewProps => ({
  traceId: 'trace-1',
  spans: withEntityType(entityType),
  onClose: vi.fn(),
  placement: 'traces-list',
  messagesPanelSlot: <div>messages</div>,
});

const storageKey = (entityType: string) =>
  `react-resizable-panels:mastra:trace-panel-layout:${entityType}:trace-side:trace-main`;

const defaultSidePanelFlexGrow = () => {
  const { unmount } = render(<TraceDataPanelView {...props('agent')} />);
  const value = sidePanelFlexGrow();
  unmount();
  return value;
};

const sidePanelFlexGrow = () =>
  (document.body.querySelector('[data-panel][id="trace-side"]') as HTMLElement | null)?.style.flexGrow;

describe('TraceDataPanelView — persisted layout', () => {
  it('restores the column sizes stored for the trace entity type', () => {
    localStorage.setItem(storageKey('agent'), JSON.stringify({ 'trace-side': 25, 'trace-main': 75 }));

    render(<TraceDataPanelView {...props('agent')} />);

    expect(sidePanelFlexGrow()).toBe('25');
  });

  it('does not apply a layout stored for another entity type', () => {
    localStorage.setItem(storageKey('agent'), JSON.stringify({ 'trace-side': 25, 'trace-main': 75 }));

    render(<TraceDataPanelView {...props('scorer')} />);

    expect(sidePanelFlexGrow()).not.toBe('25');
  });

  it('falls back to the default layout when the stored value is corrupted', () => {
    const expected = defaultSidePanelFlexGrow();
    localStorage.setItem(storageKey('agent'), '{not json');

    render(<TraceDataPanelView {...props('agent')} />);

    expect(sidePanelFlexGrow()).toBe(expected);
  });

  it('falls back to the default layout when storage is unavailable', () => {
    const expected = defaultSidePanelFlexGrow();
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });

    render(<TraceDataPanelView {...props('agent')} />);

    expect(sidePanelFlexGrow()).toBe(expected);
    getItem.mockRestore();
  });
});
