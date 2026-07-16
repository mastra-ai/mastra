// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import SignalsOverviewPage from '..';
import {
  emptyThemeEntitiesResponse,
  populatedThemeEntitiesResponse,
  themeFlowResponse,
  themeSnapshotsResponse,
} from './fixtures/theme-flow';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:3100';
const PROJECT_ID = 'project-1';

function renderSignalsPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <SignalsOverviewPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  window.MASTRA_PLATFORM_OBSERVABILITY_ENDPOINT = BASE_URL;
  window.MASTRA_PLATFORM_PROJECT_ID = PROJECT_ID;
});

afterEach(() => {
  cleanup();
  window.MASTRA_PLATFORM_OBSERVABILITY_ENDPOINT = undefined;
  window.MASTRA_PLATFORM_PROJECT_ID = undefined;
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

      expect(await screen.findByRole('status', { name: 'Loading signal analysis' })).not.toBeNull();
    });
  });

  describe('when no Agent Learning entities exist', () => {
    it('shows the Signals onboarding empty state', async () => {
      server.use(http.get(`${BASE_URL}/api/learning/entities`, () => HttpResponse.json(emptyThemeEntitiesResponse)));

      renderSignalsPage();

      expect(
        await screen.findByRole('heading', { name: 'Understand what drives every agent interaction' }),
      ).not.toBeNull();
    });
  });

  describe('when an agent has theme flow data', () => {
    it('shows the Sankey signal flow', async () => {
      server.use(
        http.get(`${BASE_URL}/api/learning/entities`, () => HttpResponse.json(populatedThemeEntitiesResponse)),
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-snapshots`, () =>
          HttpResponse.json(themeSnapshotsResponse),
        ),
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-flow`, () =>
          HttpResponse.json(themeFlowResponse),
        ),
      );

      renderSignalsPage();

      expect(await screen.findByRole('region', { name: 'Signal theme flow' })).not.toBeNull();
    });
  });

  describe('when an agent has no theme snapshots', () => {
    it('shows the Signals onboarding empty state', async () => {
      server.use(
        http.get(`${BASE_URL}/api/learning/entities`, () => HttpResponse.json(populatedThemeEntitiesResponse)),
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-snapshots`, () =>
          HttpResponse.json({ snapshots: [] }),
        ),
      );

      renderSignalsPage();

      expect(
        await screen.findByRole('heading', { name: 'Understand what drives every agent interaction' }),
      ).not.toBeNull();
    });
  });
});
