import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useLocation } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import Metrics from '..';
import {
  aggregate,
  breakdown,
  percentiles,
  supportedStorage,
  timeSeries,
  unsupportedStorage,
  emptyEntityNames,
  emptyEnvironments,
  emptyServiceNames,
  emptyTags,
} from './fixtures/metrics';
import { TestLinkProvider } from '@/test/link-provider';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

const unavailableTitle = 'Metrics are not available with your current storage';

function observeRequests() {
  const onMetrics = vi.fn();
  const onDiscovery = vi.fn();
  server.use(
    http.post(`${TEST_BASE_URL}/api/observability/metrics/:operation`, ({ params }) => {
      onMetrics();
      switch (params.operation) {
        case 'aggregate':
          return HttpResponse.json(aggregate);
        case 'breakdown':
          return HttpResponse.json(breakdown);
        case 'percentiles':
          return HttpResponse.json(percentiles);
        case 'timeseries':
          return HttpResponse.json(timeSeries);
        default:
          return new HttpResponse(undefined, { status: 404 });
      }
    }),
    http.get(`${TEST_BASE_URL}/api/observability/discovery/:field`, ({ params }) => {
      onDiscovery();
      switch (params.field) {
        case 'tags':
          return HttpResponse.json(emptyTags);
        case 'entity-names':
          return HttpResponse.json(emptyEntityNames);
        case 'service-names':
          return HttpResponse.json(emptyServiceNames);
        default:
          return HttpResponse.json(emptyEnvironments);
      }
    }),
  );
  return { onMetrics, onDiscovery };
}

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.search}</output>;
}

function renderPage(path = '/metrics') {
  return renderWithProviders(
    <TestLinkProvider>
      <Metrics />
      <LocationProbe />
    </TestLinkProvider>,
    { router: { initialEntries: [path] } },
  );
}

describe('Metrics storage support', () => {
  describe.each([
    [401, 'Session Expired'],
    [403, 'Permission Denied'],
    [500, 'Failed to load storage capabilities'],
  ] as const)('when the capability lookup returns HTTP %i', (status, title) => {
    it('shows the error without declaring the storage unsupported', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}/api/system/packages`, () =>
          HttpResponse.json({ error: 'Capability lookup failed' }, { status }),
        ),
      );
      const { onMetrics, onDiscovery } = observeRequests();

      const { queryClient } = renderPage();

      await waitFor(() => expect(queryClient.isFetching()).toBe(0), { timeout: 2000 });
      expect(screen.queryByText(unavailableTitle)).toBeNull();
      expect(screen.getByText(title)).toBeTruthy();
      expect(onMetrics).not.toHaveBeenCalled();
      expect(onDiscovery).not.toHaveBeenCalled();
    });
  });

  describe('when storage does not support metrics', () => {
    it('shows the unavailable state without requesting metrics or filter discovery', async () => {
      server.use(http.get(`${TEST_BASE_URL}/api/system/packages`, () => HttpResponse.json(unsupportedStorage)));
      const { onMetrics, onDiscovery } = observeRequests();

      const { queryClient } = renderPage();

      expect(await screen.findByText(unavailableTitle)).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Last 24 hours' })).toBeTruthy();
      await waitFor(() => expect(queryClient.isFetching()).toBe(0));
      expect(onMetrics).not.toHaveBeenCalled();
      expect(onDiscovery).not.toHaveBeenCalled();
    });

    it('preserves the active URL filter without requesting discovery', async () => {
      server.use(http.get(`${TEST_BASE_URL}/api/system/packages`, () => HttpResponse.json(unsupportedStorage)));
      const { onMetrics, onDiscovery } = observeRequests();

      const { queryClient } = renderPage('/metrics?filterEnvironment=production');

      expect(await screen.findByText(unavailableTitle)).toBeTruthy();
      expect(screen.getByText('production')).toBeTruthy();
      expect(screen.getByTestId('location').textContent).toBe('?filterEnvironment=production');
      await waitFor(() => expect(queryClient.isFetching()).toBe(0));
      expect(onMetrics).not.toHaveBeenCalled();
      expect(onDiscovery).not.toHaveBeenCalled();
    });

    it('updates the date preset in the URL without requesting metrics', async () => {
      server.use(http.get(`${TEST_BASE_URL}/api/system/packages`, () => HttpResponse.json(unsupportedStorage)));
      const { onMetrics, onDiscovery } = observeRequests();

      const { queryClient } = renderPage();
      expect(await screen.findByText(unavailableTitle)).toBeTruthy();

      fireEvent.click(screen.getByRole('button', { name: 'Last 24 hours' }));
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Last 7 days' }));

      await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('?period=7d'));
      expect(screen.getByRole('button', { name: 'Last 7 days' })).toBeTruthy();
      await waitFor(() => expect(queryClient.isFetching()).toBe(0));
      expect(onMetrics).not.toHaveBeenCalled();
      expect(onDiscovery).not.toHaveBeenCalled();
    });
  });

  describe('when a failed capability lookup recovers', () => {
    it('loads the supported dashboard after the next capability fetch', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}/api/system/packages`, () =>
          HttpResponse.json({ error: 'Temporarily unavailable' }, { status: 500 }),
        ),
      );
      const { onMetrics } = observeRequests();
      const { queryClient } = renderPage();
      expect(await screen.findByText('Failed to load storage capabilities')).toBeTruthy();
      server.use(http.get(`${TEST_BASE_URL}/api/system/packages`, () => HttpResponse.json(supportedStorage)));

      await act(() => queryClient.invalidateQueries({ queryKey: ['mastra-packages'] }));

      await waitFor(() => expect(queryClient.isFetching()).toBe(0));
      expect(screen.getByText('Total Agent Runs')).toBeTruthy();
      expect(onMetrics).toHaveBeenCalled();
    });
  });

  describe('when storage capabilities are still loading', () => {
    it('shows a loading state until support allows dashboard requests', async () => {
      let release = () => {};
      const pending = new Promise<void>(resolve => {
        release = resolve;
      });
      const onPackages = vi.fn();
      server.use(
        http.get(`${TEST_BASE_URL}/api/system/packages`, async () => {
          onPackages();
          await pending;
          return HttpResponse.json(supportedStorage);
        }),
      );
      const { onMetrics, onDiscovery } = observeRequests();

      const { queryClient } = renderPage();

      await waitFor(() => expect(onPackages).toHaveBeenCalled());
      try {
        expect(screen.getByRole('status', { name: 'Loading storage capabilities' })).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Last 24 hours' })).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Add Filter' }).hasAttribute('disabled')).toBe(true);
        expect(onMetrics).not.toHaveBeenCalled();
        expect(onDiscovery).not.toHaveBeenCalled();
      } finally {
        await act(async () => release());
      }
      await waitFor(() => expect(queryClient.isFetching()).toBe(0));
      expect(screen.queryByRole('status', { name: 'Loading storage capabilities' })).toBeNull();
      expect(onMetrics).toHaveBeenCalled();
      expect(onDiscovery).toHaveBeenCalled();
      expect(screen.getByText('Total Agent Runs')).toBeTruthy();
    });
  });
});
