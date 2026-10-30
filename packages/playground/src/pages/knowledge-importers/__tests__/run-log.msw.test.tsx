import type { KnowledgeImporterRunEvent, KnowledgeImporterRunSummary } from '@mastra/client-js';
import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { LinkComponentProvider } from '@mastra/playground-ui/lib/framework';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import KnowledgeImportersPage from '..';
import {
  buildListImportersResponse,
  buildNotionPreview,
  buildNotionSummary,
  buildRun,
  buildRunEvent,
  NOTION_KEY,
} from './fixtures/importers';
import { Link } from '@/lib/link';
import { stubLinkPaths } from '@/test/link-provider';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

const API = `${TEST_BASE_URL}/knowledge-importers`;
const POLL_TIMEOUT = { timeout: 5000 };

const STARTED = buildRunEvent(1, 'Started an import from Notion.', { type: 'started' });
const FETCHED = buildRunEvent(2, 'Fetched 3 items from Notion (request 1).', {
  level: 'debug',
  type: 'fetch',
  afterMs: 1200,
  data: { provider: 'Notion', request: 1, count: 3 },
});
const FETCHED_AGAIN = buildRunEvent(3, 'Fetched 2 items from Notion (request 2).', {
  level: 'debug',
  type: 'fetch',
  afterMs: 1800,
  data: { provider: 'Notion', request: 2, count: 2 },
});
const CREATED = buildRunEvent(4, 'Created "Release checklist" in Engineering.', { afterMs: 2400 });
const RATE_LIMITED = buildRunEvent(5, 'Notion asked us to slow down (request 3).', {
  level: 'warn',
  type: 'rate_limited',
  afterMs: 3000,
});
const FAILED_REQUEST = buildRunEvent(6, 'Request 4 to Notion failed (HTTP 500).', {
  level: 'error',
  type: 'error',
  afterMs: 3600,
});
const FINISHED = buildRunEvent(7, 'Finished: 1 created, 0 updated, 2 records written, 0 skipped, 0 removed.', {
  type: 'finished',
  afterMs: 65_000,
});

const showRuns = (runs: KnowledgeImporterRunSummary[]) => {
  server.use(
    http.get(API, () => HttpResponse.json(buildListImportersResponse([buildNotionSummary()]))),
    http.get(`${API}/:key/runs`, () => HttpResponse.json({ runs })),
  );
};

/** Serves the log in the given pages, one page per request, and records each `after` cursor. */
const serveLog = (pages: { events: KnowledgeImporterRunEvent[]; done: boolean }[]) => {
  const cursors = vi.fn<(after: string | null, runId: string | undefined) => void>();
  let served = 0;
  server.use(
    http.get(`${API}/:key/runs/:runId/events`, ({ request, params }) => {
      const runId = typeof params.runId === 'string' ? params.runId : undefined;
      cursors(new URL(request.url).searchParams.get('after'), runId);
      const page = pages[Math.min(served, pages.length - 1)];
      served += 1;
      return HttpResponse.json(page);
    }),
  );
  return cursors;
};

const renderPage = () =>
  renderWithProviders(
    <TooltipProvider>
      <LinkComponentProvider Link={Link} navigate={() => {}} paths={stubLinkPaths}>
        <Routes>
          <Route path="/knowledge/importers" element={<KnowledgeImportersPage />} />
        </Routes>
      </LinkComponentProvider>
    </TooltipProvider>,
    { router: { initialEntries: [`/knowledge/importers?importer=${encodeURIComponent(NOTION_KEY)}`] } },
  );

const openLog = async (runId: string) => {
  const row = await screen.findByTestId(`run-row-${runId}`);
  fireEvent.click(within(row).getByRole('button', { name: 'View log' }));
  return screen.findByRole('dialog');
};

const lines = (log: HTMLElement) =>
  within(log)
    .queryAllByRole('listitem')
    .map(item => item.textContent);

afterEach(cleanup);

describe('Importer run log', () => {
  describe('when a run is still going', () => {
    it('tails new lines by asking only for events after the last one shown', async () => {
      showRuns([buildRun({ id: 'run_live', kind: 'run' })]);
      const cursors = serveLog([
        { events: [STARTED, FETCHED], done: false },
        { events: [FETCHED_AGAIN, CREATED], done: false },
        { events: [FINISHED], done: true },
      ]);
      renderPage();

      const drawer = await openLog('run_live');
      expect(await within(drawer).findByText('Fetching from Notion: 1 request')).toBeTruthy();
      expect(within(drawer).getByText('+1.2s')).toBeTruthy();
      expect(within(drawer).getByTestId('run-log-live')).toBeTruthy();

      expect(
        await within(drawer).findByText('Created "Release checklist" in Engineering.', {}, POLL_TIMEOUT),
      ).toBeTruthy();
      expect(within(drawer).getByText('Fetching from Notion: 2 requests')).toBeTruthy();
      const outcome = await within(drawer).findByTestId('run-log-outcome', {}, POLL_TIMEOUT);
      expect(outcome.textContent).toContain('1 created, 0 updated, 2 records written');
      expect(within(drawer).queryByTestId('run-log-live')).toBeNull();
      expect(within(drawer).getByText('+1m 05s')).toBeTruthy();
      expect(within(drawer).getByText('Fetched from Notion: 2 requests')).toBeTruthy();

      expect(cursors.mock.calls).toEqual([
        [null, 'run_live'],
        ['2', 'run_live'],
        ['4', 'run_live'],
      ]);
      expect(lines(within(drawer).getByRole('list', { name: 'Run log' }))).toHaveLength(4);
    });
  });

  describe('when opened from a preview that is still running', () => {
    it('stays open with the final counts after the preview settles', async () => {
      showRuns([]);
      let polls = 0;
      server.use(
        http.post(`${API}/:key/dry-run`, () => HttpResponse.json({ runId: 'run_dry' }, { status: 202 })),
        http.get(`${API}/runs/run_dry`, () => {
          polls += 1;
          return HttpResponse.json(polls < 3 ? buildRun() : buildNotionPreview());
        }),
      );
      serveLog([
        { events: [STARTED, FETCHED], done: false },
        { events: [CREATED, FINISHED], done: true },
      ]);
      renderPage();

      fireEvent.click(await screen.findByRole('button', { name: 'Preview import' }));
      const progress = await screen.findByTestId('run-in-progress');
      fireEvent.click(await within(progress).findByRole('button', { name: 'View log' }));
      const drawer = await screen.findByRole('dialog');

      await waitFor(() => expect(screen.queryByTestId('run-in-progress')).toBeNull(), POLL_TIMEOUT);
      expect(await within(drawer).findByTestId('run-log-outcome', {}, POLL_TIMEOUT)).toBeTruthy();
      expect(screen.getByRole('dialog')).toBe(drawer);
    });
  });

  describe('when filtering by level', () => {
    it('shows only warnings and errors, then only errors, and keeps the final counts', async () => {
      showRuns([buildNotionPreview({ id: 'run_done', kind: 'run' })]);
      serveLog([{ events: [STARTED, FETCHED, RATE_LIMITED, FAILED_REQUEST, FINISHED], done: true }]);
      renderPage();

      const drawer = await openLog('run_done');
      const log = await within(drawer).findByRole('list', { name: 'Run log' });
      expect(lines(log)).toHaveLength(5);

      fireEvent.click(within(drawer).getByRole('radio', { name: 'Warnings' }));
      expect(lines(within(drawer).getByRole('list', { name: 'Run log' }))).toEqual([
        expect.stringContaining(RATE_LIMITED.message),
        expect.stringContaining(FAILED_REQUEST.message),
      ]);

      fireEvent.click(within(drawer).getByRole('radio', { name: 'Errors' }));
      expect(lines(within(drawer).getByRole('list', { name: 'Run log' }))).toEqual([
        expect.stringContaining(FAILED_REQUEST.message),
      ]);
      expect(within(drawer).getByTestId('run-log-outcome').textContent).toContain(FINISHED.message);

      fireEvent.click(within(drawer).getByRole('radio', { name: 'All' }));
      expect(lines(within(drawer).getByRole('list', { name: 'Run log' }))).toHaveLength(5);
    });

    it('folds provider requests into one line until asked to show them', async () => {
      showRuns([buildNotionPreview({ id: 'run_done', kind: 'run' })]);
      serveLog([{ events: [STARTED, FETCHED, FETCHED_AGAIN, CREATED, FINISHED], done: true }]);
      renderPage();

      const drawer = await openLog('run_done');
      const log = await within(drawer).findByRole('list', { name: 'Run log' });
      expect(lines(log)).toEqual([
        expect.stringContaining(STARTED.message),
        expect.stringContaining('Fetched from Notion: 2 requests'),
        expect.stringContaining(CREATED.message),
        expect.stringContaining(FINISHED.message),
      ]);

      fireEvent.click(within(drawer).getByRole('switch', { name: 'Show requests' }));
      expect(lines(within(drawer).getByRole('list', { name: 'Run log' }))).toEqual([
        expect.stringContaining(STARTED.message),
        expect.stringContaining(FETCHED.message),
        expect.stringContaining(FETCHED_AGAIN.message),
        expect.stringContaining(CREATED.message),
        expect.stringContaining(FINISHED.message),
      ]);

      fireEvent.click(within(drawer).getByRole('radio', { name: 'Warnings' }));
      expect(within(drawer).queryByRole('switch', { name: 'Show requests' })).toBeNull();
      expect(within(drawer).getByText('Nothing logged at this level.')).toBeTruthy();
    });

    // The drawer's swipe-to-dismiss captures any mouse press outside its interactive region, which
    // swallows clicks on the level filter (its items are radios, not buttons) and blocks text selection.
    it('keeps the filter and the lines out of the swipe-to-dismiss gesture', async () => {
      showRuns([buildNotionPreview({ id: 'run_done', kind: 'run' })]);
      serveLog([{ events: [STARTED, FINISHED], done: true }]);
      renderPage();

      const drawer = await openLog('run_done');
      const log = await within(drawer).findByRole('list', { name: 'Run log' });
      expect(
        within(drawer).getByRole('radiogroup', { name: 'Show levels' }).closest('[data-drawer-content]'),
      ).not.toBeNull();
      expect(log.closest('[data-drawer-content]')).not.toBeNull();
    });
  });

  describe('when the run has finished', () => {
    it('reads the log once and stops polling', async () => {
      showRuns([buildNotionPreview({ id: 'run_done', kind: 'run' })]);
      const cursors = serveLog([{ events: [STARTED, FINISHED], done: true }]);
      renderPage();

      const drawer = await openLog('run_done');
      expect(await within(drawer).findByTestId('run-log-outcome')).toBeTruthy();
      await new Promise(resolve => setTimeout(resolve, 1500));
      expect(cursors).toHaveBeenCalledTimes(1);
    });

    it('says so when a run ended without a final summary', async () => {
      showRuns([buildNotionPreview({ id: 'run_cut', kind: 'run', status: 'failed' })]);
      serveLog([{ events: [STARTED], done: true }]);
      renderPage();

      const drawer = await openLog('run_cut');
      const outcome = await within(drawer).findByTestId('run-log-outcome');
      expect(outcome.textContent).toContain('The run ended without a final summary.');
    });

    it('never asks for a log until one is opened', async () => {
      showRuns([buildNotionPreview({ id: 'run_done', kind: 'run' })]);
      const cursors = serveLog([{ events: [STARTED, FINISHED], done: true }]);
      renderPage();

      await screen.findByTestId('run-row-run_done');
      await waitFor(() => expect(screen.getAllByRole('button', { name: 'View log' }).length).toBeGreaterThan(0));
      expect(cursors).not.toHaveBeenCalled();
    });
  });

  describe('when the log cannot be read', () => {
    it('explains the failure instead of an empty log', async () => {
      showRuns([buildNotionPreview({ id: 'run_done', kind: 'run' })]);
      server.use(
        http.get(`${API}/:key/runs/:runId/events`, () =>
          HttpResponse.json({ error: { code: 'forbidden', message: 'Missing knowledge:read.' } }, { status: 403 }),
        ),
      );
      renderPage();

      const drawer = await openLog('run_done');
      expect(await within(drawer).findByText("Couldn't load the run log")).toBeTruthy();
    });
  });
});
