import type { DatasetExperiment } from '@mastra/client-js';
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { experiments } from '../components/__tests__/fixtures/experiments';
import { ExperimentCrumbItemCount, ExperimentCrumbStatusIcon } from '../experiment-crumb';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

const base = experiments[0];

// What a run looks like right after it is triggered: the unscoped lookup never moves past this.
const triggered: DatasetExperiment = { ...base, status: 'pending', succeededCount: 0, completedAt: null };
let liveStatus: DatasetExperiment['status'] = 'pending';
let unscopedCalls = 0;

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  liveStatus = 'pending';
  unscopedCalls = 0;
  server.use(
    http.get(`${TEST_BASE_URL}/api/experiments/:experimentId`, () => {
      unscopedCalls += 1;
      return HttpResponse.json(triggered);
    }),
    http.get(`${TEST_BASE_URL}/api/datasets/:datasetId/experiments/:experimentId`, () =>
      HttpResponse.json({ ...triggered, status: liveStatus }),
    ),
  );
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const renderIcon = () =>
  renderWithProviders(
    <Routes>
      <Route path="/experiments/:experimentId" element={<ExperimentCrumbStatusIcon />} />
    </Routes>,
    { router: { initialEntries: [`/experiments/${base.id}`] } },
  );

/** The icon only names its state through the tooltip, so focus the trigger to read it. */
const statusLabel = async (label: string) => {
  const trigger = await waitFor(() => {
    const el = document.querySelector('[tabindex="0"]');
    if (!el) throw new Error('status icon not rendered');
    return el;
  });
  fireEvent.blur(trigger);
  fireEvent.focus(trigger);
  return screen.findByText(label);
};

const advancePoll = () =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(2100);
  });

describe('ExperimentCrumbStatusIcon', () => {
  it('follows the run from queued to in progress to completed without a reload', async () => {
    renderIcon();

    expect(await statusLabel('Run queued')).toBeTruthy();

    liveStatus = 'running';
    await advancePoll();
    expect(await statusLabel('Run in progress')).toBeTruthy();
    expect(screen.getByRole('status', { name: 'Loading' })).toBeTruthy();

    liveStatus = 'completed';
    await advancePoll();
    expect(await statusLabel('Run completed')).toBeTruthy();
    expect(screen.queryByRole('status', { name: 'Loading' })).toBeNull();

    // The header reads the polled dataset-scoped query, not repeated unscoped lookups.
    expect(unscopedCalls).toBe(1);
  });
});

describe('ExperimentCrumbItemCount', () => {
  const renderCount = () =>
    renderWithProviders(
      <Routes>
        <Route path="/experiments/:experimentId" element={<ExperimentCrumbItemCount />} />
      </Routes>,
      { router: { initialEntries: [`/experiments/${base.id}`] } },
    );

  const stubLiveExperiment = (experiment: DatasetExperiment) =>
    server.use(
      http.get(`${TEST_BASE_URL}/api/datasets/:datasetId/experiments/:experimentId`, () =>
        HttpResponse.json(experiment),
      ),
    );

  describe('when the run is in progress', () => {
    it('leaves the progress to the page body until the run completes', async () => {
      let liveExperimentCalls = 0;
      server.use(
        http.get(`${TEST_BASE_URL}/api/datasets/:datasetId/experiments/:experimentId`, () => {
          liveExperimentCalls += 1;
          return HttpResponse.json({ ...triggered, status: 'running', succeededCount: 3, failedCount: 1 });
        }),
      );
      renderCount();

      await waitFor(() => expect(liveExperimentCalls).toBeGreaterThan(0));
      expect(screen.queryByText(/items?\b/)).toBeNull();

      stubLiveExperiment({ ...triggered, status: 'completed', succeededCount: 10, failedCount: 0 });
      await advancePoll();

      expect(await screen.findByText('10 items')).toBeTruthy();
    });
  });

  describe('when the run completed with errors', () => {
    it('shows the total item count with the errored items', async () => {
      stubLiveExperiment({ ...base, status: 'completed', succeededCount: 8, failedCount: 2 });
      renderCount();

      expect(await screen.findByText('10 items · 2 errored')).toBeTruthy();
    });
  });

  describe('when the run has a single item', () => {
    it('uses the singular noun', async () => {
      stubLiveExperiment({ ...base, status: 'completed', totalItems: 1, succeededCount: 1, failedCount: 0 });
      renderCount();

      expect(await screen.findByText('1 item')).toBeTruthy();
    });
  });
});
