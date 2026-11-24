// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ObservabilityViewsState } from '../../hooks/use-observability-views';
import { ObservabilityPageLayout } from '../observability-page-layout';
import type { ObservabilityView } from '@/domains/traces/components/traces-spans-switch';
import { recordRequests } from '@/test/record-requests';

/*
 * The header shared by the traces, spans and threads pages, in an app other than Studio: no Mastra client,
 * no React Query, no router. The app says which views it offers; the header draws them and reports picks.
 */

const EVERY_VIEW: ObservabilityViewsState = {
  views: ['traces', 'spans', 'threads'],
  isLoading: false,
  showSwitch: true,
};

const renderLayout = (views: ObservabilityViewsState, current: ObservabilityView = 'traces') => {
  const onViewChange = vi.fn<(view: ObservabilityView) => void>();
  render(
    <ObservabilityPageLayout
      current={current}
      views={views}
      onViewChange={onViewChange}
      breadcrumbs={state => <nav aria-label="Breadcrumb">{state.current}</nav>}
    >
      <p>Page body</p>
    </ObservabilityPageLayout>,
  );
  return { onViewChange };
};

describe('ObservabilityPageLayout in an app other than Studio', () => {
  describe('when the app offers every view', () => {
    it('draws the views the app offers', () => {
      renderLayout(EVERY_VIEW);

      expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual(['Traces', 'Spans', 'Threads']);
    });

    it('reports the view the reader picks to the app', () => {
      const { onViewChange } = renderLayout(EVERY_VIEW);

      fireEvent.click(screen.getByRole('tab', { name: 'Spans' }));

      expect(onViewChange).toHaveBeenCalledWith('spans');
    });

    it('sends no request of its own', () => {
      const requests = recordRequests();

      renderLayout(EVERY_VIEW);

      expect(requests).toEqual([]);
    });
  });

  describe('while the app is still resolving its views', () => {
    it('holds the switch place with a loading placeholder', () => {
      renderLayout({ views: ['traces'], isLoading: true, showSwitch: false });

      expect(screen.getByRole('status', { name: 'Loading views' })).toBeTruthy();
      expect(screen.getByText('Page body')).toBeTruthy();
    });
  });
});
