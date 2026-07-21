// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import SignalsOverviewPage from '..';
import {
  billingThemeSnapshotsResponse,
  emptyThemeEntitiesResponse,
  lowSignalFirstThemeEntitiesResponse,
  multiAgentThemeEntitiesResponse,
  multiEligibleThemeEntitiesResponse,
  populatedThemeEntitiesResponse,
  themeFlowResponse,
  themeSnapshotsResponse,
} from './fixtures/theme-flow';
import { server } from '@/test/msw-server';

const BASE_URL = window.location.origin;

function renderSignalsPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <SignalsOverviewPage />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
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

  describe('when the entities request fails', () => {
    it('shows the entities error state', async () => {
      server.use(
        http.get(`${BASE_URL}/api/learning/entities`, () =>
          HttpResponse.json({ error: 'Unable to load entities' }, { status: 500 }),
        ),
      );

      renderSignalsPage();

      expect(await screen.findByText('Unable to load signal entities.')).not.toBeNull();
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

      renderSignalsPage();

      expect(await screen.findByText('Unable to load signal entities.')).not.toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

      expect(await screen.findByRole('combobox', { name: 'Agent' })).not.toBeNull();
      expect(attempts).toBe(2);
    });
  });

  describe('when no Agent Learning entities exist', () => {
    it('shows that the analysis is waiting for traces', async () => {
      server.use(http.get(`${BASE_URL}/api/learning/entities`, () => HttpResponse.json(emptyThemeEntitiesResponse)));

      renderSignalsPage();

      expect(await screen.findByText('Waiting for traces.')).not.toBeNull();
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

    it('labels the populated analysis', async () => {
      renderSignalsPage();

      expect(
        await screen.findByRole('heading', { name: 'Understand what drives every agent interaction' }),
      ).not.toBeNull();
    });

    it('exposes the theme flow as a named region', async () => {
      renderSignalsPage();

      expect(await screen.findByRole('region', { name: 'Signal theme flow' })).not.toBeNull();
    });

    it('keeps the single agent visible in the selector', async () => {
      renderSignalsPage();

      expect((await screen.findByRole('combobox', { name: 'Agent' })).textContent).toContain('support-agent');
    });
  });

  describe('when a low-signal agent is returned before an eligible agent', () => {
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

      renderSignalsPage();

      expect((await screen.findByRole('combobox', { name: 'Agent' })).textContent).toContain('support-agent');
      expect(screen.queryByText('Not enough signal data yet')).toBeNull();
    });
  });

  describe('when multiple agents have different signal coverage', () => {
    beforeEach(() => {
      server.use(
        http.get(`${BASE_URL}/api/learning/entities`, () => HttpResponse.json(multiAgentThemeEntitiesResponse)),
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-snapshots`, () =>
          HttpResponse.json(themeSnapshotsResponse),
        ),
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-flow`, () =>
          HttpResponse.json(themeFlowResponse),
        ),
      );
    });

    it('lists every agent in the always-visible selector', async () => {
      renderSignalsPage();

      const selector = await screen.findByRole('combobox', { name: 'Agent' });
      fireEvent.click(selector);

      expect(await screen.findByRole('option', { name: 'support-agent' })).not.toBeNull();
      expect(screen.getByRole('option', { name: 'triage-agent' })).not.toBeNull();
    });

    it('explains why the selected agent cannot render a flow', async () => {
      renderSignalsPage();

      fireEvent.click(await screen.findByRole('combobox', { name: 'Agent' }));
      const triageAgent = await screen.findByRole('option', { name: 'triage-agent' });
      fireEvent.pointerDown(triageAgent, { pointerType: 'mouse' });
      fireEvent.click(triageAgent, { detail: 1 });

      expect(await screen.findByText('Not enough signal data yet')).not.toBeNull();
      expect(screen.getByText('Available signals: Goal')).not.toBeNull();
      expect(screen.getByRole('combobox', { name: 'Agent' })).not.toBeNull();
    });
  });

  describe('when switching between eligible agents', () => {
    it("loads the selected agent's latest snapshot", async () => {
      let billingFlowSnapshotId: string | null = null;
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
          billingFlowSnapshotId = new URL(request.url).searchParams.get('snapshotId');
          return HttpResponse.json({
            ...themeFlowResponse,
            snapshot: billingThemeSnapshotsResponse.snapshots[1],
          });
        }),
      );
      renderSignalsPage();
      fireEvent.click(await screen.findByRole('combobox', { name: 'Agent' }));
      const billingAgent = await screen.findByRole('option', { name: 'billing-agent' });

      fireEvent.pointerDown(billingAgent, { pointerType: 'mouse' });
      fireEvent.click(billingAgent, { detail: 1 });

      expect(await screen.findByText('Snapshot 2/2 · Jul 8–15, 2026 · 30 traces')).not.toBeNull();
      expect(billingFlowSnapshotId).toBe('billing-snapshot-2');
    });
  });

  describe('when an agent has no theme snapshots', () => {
    it('shows that the analysis is waiting for traces', async () => {
      server.use(
        http.get(`${BASE_URL}/api/learning/entities`, () => HttpResponse.json(populatedThemeEntitiesResponse)),
        http.get(`${BASE_URL}/api/learning/entities/support-agent/theme-snapshots`, () =>
          HttpResponse.json({ snapshots: [] }),
        ),
      );

      renderSignalsPage();

      expect(await screen.findByText('Waiting for traces.')).not.toBeNull();
    });
  });
});
