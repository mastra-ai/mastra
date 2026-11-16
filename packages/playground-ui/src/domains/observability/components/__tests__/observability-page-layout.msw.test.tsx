// @vitest-environment jsdom
import type { GetObservabilityCapabilitiesResponse } from '@mastra/client-js';
import { fireEvent, screen } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { ObservabilityPageLayout } from '../observability-page-layout';
import type { ObservabilityBreadcrumbsState } from '../observability-page-layout';
import { noThreadRowsCapabilities, threadQueryCapabilities } from '@/domains/threads/__tests__/fixtures/threads';
import type { ObservabilityView } from '@/domains/traces/components/traces-spans-switch';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

const CAPABILITIES_URL = `${TEST_BASE_URL}/api/observability/capabilities`;

const setCapabilities = (capabilities: GetObservabilityCapabilitiesResponse) =>
  server.use(http.get(CAPABILITIES_URL, () => HttpResponse.json(capabilities)));

const renderLayout = (current: ObservabilityView) => {
  const onViewChange = vi.fn<(view: ObservabilityView) => void>();
  const breadcrumbs = vi.fn((state: ObservabilityBreadcrumbsState) => (
    <nav aria-label="Breadcrumb">{state.current}</nav>
  ));
  renderWithProviders(
    <ObservabilityPageLayout
      current={current}
      features={{ spanQuery: true, threadQuery: true }}
      onViewChange={onViewChange}
      breadcrumbs={breadcrumbs}
    >
      <p>Page body</p>
    </ObservabilityPageLayout>,
  );
  return { onViewChange, breadcrumbs };
};

describe('ObservabilityPageLayout', () => {
  describe('while the capabilities are loading', () => {
    it('holds the switch place with a loading placeholder', async () => {
      server.use(
        http.get(CAPABILITIES_URL, async () => {
          await delay('infinite');
          return HttpResponse.json(threadQueryCapabilities);
        }),
      );

      renderLayout('spans');

      expect(await screen.findByRole('status', { name: 'Loading views' })).toBeTruthy();
      expect(screen.getByText('Page body')).toBeTruthy();
    });
  });

  describe('when the store supports every view', () => {
    it('offers the three views with the current one selected', async () => {
      setCapabilities(threadQueryCapabilities);

      renderLayout('spans');

      const switcher = await screen.findByRole('navigation', { name: 'Observability views' });
      expect(switcher).toBeTruthy();
      expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual(['Traces', 'Spans', 'Threads']);
      expect(screen.getByRole('tab', { name: 'Spans' }).getAttribute('aria-selected')).toBe('true');
    });

    it('tells the host which view was picked', async () => {
      setCapabilities(threadQueryCapabilities);

      const { onViewChange } = renderLayout('spans');
      fireEvent.click(await screen.findByRole('tab', { name: 'Threads' }));

      expect(onViewChange).toHaveBeenCalledWith('threads');
    });
  });

  describe('when the store cannot serve the current view', () => {
    it('hides the switch', async () => {
      setCapabilities(noThreadRowsCapabilities);

      const { breadcrumbs } = renderLayout('threads');

      await vi.waitFor(() =>
        expect(breadcrumbs).toHaveBeenLastCalledWith({ current: 'threads', isLoading: false, showSwitch: false }),
      );
      expect(screen.queryByRole('navigation', { name: 'Observability views' })).toBeNull();
    });
  });
});
