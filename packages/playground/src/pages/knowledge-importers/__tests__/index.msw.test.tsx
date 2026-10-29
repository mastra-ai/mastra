import type { KnowledgeImporterSummary, SaveKnowledgeImporterSettingsParams } from '@mastra/client-js';
import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { LinkComponentProvider } from '@mastra/playground-ui/lib/framework';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import KnowledgeImportersPage from '..';
import {
  buildListImportersResponse,
  buildNotionSummary,
  buildRun,
  buildSlackSummary,
  notionConnections,
} from './fixtures/importers';
import { Link } from '@/lib/link';
import { stubLinkPaths } from '@/test/link-provider';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

// Custom server routes mount at their own path, not under /api.
const API = `${TEST_BASE_URL}/knowledge-importers`;
const POLL_TIMEOUT = { timeout: 5000 };
const NARROWING_COPY = 'Stops new imports. Knowledge already imported stays.';
const READ_ONLY_COPY = 'Read-only: ask an org admin';

const useSummaries = (summaries: KnowledgeImporterSummary[], canWrite = true) => {
  server.use(
    http.get(API, () => HttpResponse.json(buildListImportersResponse(summaries, canWrite))),
    http.get(`${API}/:importerId/connections`, () => HttpResponse.json(notionConnections)),
    http.get(`${API}/:importerId/runs`, () => HttpResponse.json({ runs: [] })),
  );
};

const renderPage = (initialEntry = '/knowledge/importers') =>
  renderWithProviders(
    <TooltipProvider>
      <LinkComponentProvider Link={Link} navigate={() => {}} paths={stubLinkPaths}>
        <Routes>
          <Route path="/knowledge/importers" element={<KnowledgeImportersPage />} />
        </Routes>
      </LinkComponentProvider>
    </TooltipProvider>,
    { router: { initialEntries: [initialEntry] } },
  );

describe('Knowledge importers page', () => {
  describe('when the server lists a connected and an unconnected importer', () => {
    beforeEach(() => useSummaries([buildNotionSummary(), buildSlackSummary()]));

    it('shows the effective schedule in plain words', async () => {
      renderPage();
      const row = await screen.findByTestId('importer-row-notion');
      expect(within(row).getByText('every 15 minutes')).toBeTruthy();
    });

    it('shows a disabled importer as paused', async () => {
      renderPage();
      const row = await screen.findByTestId('importer-row-slack');
      expect(within(row).getByText('paused')).toBeTruthy();
    });

    it('marks the unconnected importer as not connected to this project', async () => {
      renderPage();
      const row = await screen.findByTestId('importer-row-slack');
      expect(within(row).getByText('Not connected to this project')).toBeTruthy();
    });

    it('hides run controls for the unconnected importer', async () => {
      renderPage('/knowledge/importers?importer=slack');
      await screen.findByRole('heading', { name: 'Slack' });
      expect(screen.queryByRole('button', { name: 'Dry run' })).toBeNull();
    });
  });

  describe('when an allowlist option is empty', () => {
    beforeEach(() =>
      useSummaries([
        buildNotionSummary({
          settings: { ...buildNotionSummary().settings, options: { teamspaces: [] } },
        }),
      ]),
    );

    it('says the importer imports nothing', async () => {
      renderPage();
      expect(await screen.findByText('Empty — imports nothing. Add at least one entry.')).toBeTruthy();
    });
  });

  describe('when saving and nobody else changed the settings', () => {
    let saved: SaveKnowledgeImporterSettingsParams | undefined;

    beforeEach(() => {
      saved = undefined;
      useSummaries([buildNotionSummary()]);
      server.use(
        http.put<never, SaveKnowledgeImporterSettingsParams>(`${API}/notion/settings`, async ({ request }) => {
          const body = await request.json();
          saved = body;
          return HttpResponse.json(
            buildNotionSummary({
              settings: { ...buildNotionSummary().settings, options: body.options, version: 4 },
            }),
          );
        }),
      );
    });

    it('sends the edited allowlist with the version it was based on', async () => {
      renderPage();
      const input = await screen.findByLabelText('Add to Teamspaces');
      fireEvent.change(input, { target: { value: 'Design' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => expect(saved).toBeDefined());
      expect(saved).toEqual({
        enabled: true,
        schedule: null,
        connectionId: null,
        options: { teamspaces: ['Engineering', 'Design'] },
        expectedVersion: 3,
      });
    });
  });

  describe('when saving after someone else changed the settings', () => {
    let listCalls = 0;

    beforeEach(() => {
      listCalls = 0;
      useSummaries([buildNotionSummary()]);
      server.use(
        http.get(API, () => {
          listCalls += 1;
          const latest =
            listCalls === 1
              ? buildNotionSummary()
              : buildNotionSummary({
                  settings: { ...buildNotionSummary().settings, options: { teamspaces: ['Sales'] }, version: 5 },
                });
          return HttpResponse.json(buildListImportersResponse([latest]));
        }),
        http.put(`${API}/notion/settings`, () =>
          HttpResponse.json(
            { error: { code: 'version_conflict', message: 'Settings changed since version 3' } },
            { status: 409 },
          ),
        ),
      );
    });

    const saveEdit = async () => {
      renderPage();
      const input = await screen.findByLabelText('Add to Teamspaces');
      fireEvent.change(input, { target: { value: 'Design' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    };

    it('tells the user someone else changed the settings', async () => {
      await saveEdit();
      expect(await screen.findByText('Someone else changed these settings')).toBeTruthy();
    });

    it('reloads the form with the latest saved values', async () => {
      await saveEdit();
      const entries = await screen.findByRole('list', { name: 'Teamspaces entries' });
      await waitFor(() => expect(within(entries).getByText('Sales')).toBeTruthy());
    });
  });

  describe('when a dry run of unsaved settings succeeds', () => {
    let dryRunBody: unknown;
    let polls = 0;

    beforeEach(() => {
      dryRunBody = undefined;
      polls = 0;
      useSummaries([buildNotionSummary()]);
      server.use(
        http.post(`${API}/notion/dry-run`, async ({ request }) => {
          dryRunBody = await request.json();
          return HttpResponse.json({ runId: 'run_dry' }, { status: 202 });
        }),
        http.get(`${API}/runs/run_dry`, () => {
          polls += 1;
          return HttpResponse.json(
            polls === 1
              ? buildRun()
              : buildRun({
                  status: 'succeeded',
                  completedAt: '2026-10-29T13:00:05.000Z',
                  counts: { nodesCreated: 12, skipped: 3 },
                  skipped: [{ reason: 'slack-private-conversation', count: 3 }],
                }),
          );
        }),
      );
    });

    const startDryRun = async () => {
      renderPage();
      const input = await screen.findByLabelText('Add to Teamspaces');
      fireEvent.change(input, { target: { value: 'Design' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      fireEvent.click(screen.getByRole('button', { name: 'Dry run' }));
    };

    it('previews the unsaved form values', async () => {
      await startDryRun();
      await waitFor(() => expect(dryRunBody).toBeDefined());
      expect(dryRunBody).toEqual({
        settings: {
          enabled: true,
          schedule: null,
          connectionId: null,
          options: { teamspaces: ['Engineering', 'Design'] },
        },
      });
    });

    it('polls until the run settles and shows its counts', async () => {
      await startDryRun();
      expect(
        await screen.findByText(/Dry run — nothing was written\. 12 created · 3 skipped/, undefined, POLL_TIMEOUT),
      ).toBeTruthy();
    });

    it('lists why items were skipped', async () => {
      await startDryRun();
      const skipped = await screen.findByRole('rowgroup', { name: 'Skipped items' }, POLL_TIMEOUT);
      expect(within(skipped).getByText('slack-private-conversation')).toBeTruthy();
    });
  });

  describe('when a dry run fails', () => {
    beforeEach(() => {
      useSummaries([buildNotionSummary()]);
      server.use(
        http.post(`${API}/notion/dry-run`, () => HttpResponse.json({ runId: 'run_dry' }, { status: 202 })),
        http.get(`${API}/runs/run_dry`, () =>
          HttpResponse.json(
            buildRun({ status: 'failed', completedAt: '2026-10-29T13:00:01.000Z', error: 'Notion API returned 401' }),
          ),
        ),
      );
    });

    it('shows the run error', async () => {
      renderPage();
      fireEvent.click(await screen.findByRole('button', { name: 'Dry run' }));
      await waitFor(() =>
        expect(within(screen.getByTestId('run-result')).getByText('Notion API returned 401')).toBeTruthy(),
      );
    });
  });

  describe('when a run is already in progress', () => {
    beforeEach(() => {
      useSummaries([buildNotionSummary()]);
      server.use(
        http.post(`${API}/notion/dry-run`, () =>
          HttpResponse.json({ error: { code: 'run_in_progress', message: 'busy' } }, { status: 409 }),
        ),
      );
    });

    it('explains that a run is already going', async () => {
      renderPage();
      fireEvent.click(await screen.findByRole('button', { name: 'Dry run' }));
      expect(
        await screen.findByText('A run is already in progress for this importer. Wait for it to finish.'),
      ).toBeTruthy();
    });
  });

  describe('when the allowlist has entries', () => {
    beforeEach(() => useSummaries([buildNotionSummary()]));

    it('says narrowing it keeps knowledge already imported', async () => {
      renderPage();
      const field = (await screen.findByLabelText('Add to Teamspaces')).closest('[data-slot="field"]');
      expect(field).not.toBeNull();
      expect(within(field as HTMLElement).getByText(NARROWING_COPY)).toBeTruthy();
    });
  });

  describe('when turning off automatic imports', () => {
    beforeEach(() => useSummaries([buildNotionSummary()]));

    it('confirms that knowledge already imported stays', async () => {
      renderPage();
      fireEvent.click(await screen.findByRole('switch', { name: 'Automatic imports' }));
      const dialog = await screen.findByRole('alertdialog');
      expect(within(dialog).getByText(NARROWING_COPY, { exact: false })).toBeTruthy();
    });

    it('turns them off once confirmed', async () => {
      renderPage();
      fireEvent.click(await screen.findByRole('switch', { name: 'Automatic imports' }));
      fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Turn off' }));
      expect(await screen.findByText('Off — only manual runs.')).toBeTruthy();
    });
  });

  describe('when the caller cannot write', () => {
    beforeEach(() => useSummaries([buildNotionSummary()], false));

    it('says the page is read-only', async () => {
      renderPage();
      expect(await screen.findByText(READ_ONLY_COPY)).toBeTruthy();
    });

    it('hides save, reset, dry run and run now', async () => {
      renderPage();
      await screen.findByText(READ_ONLY_COPY);
      const names = ['Save', 'Reset to environment', 'Dry run', 'Run now'];
      expect(names.filter(name => screen.queryByRole('button', { name }))).toEqual([]);
    });

    it('hides the automatic imports switch', async () => {
      renderPage();
      await screen.findByText(READ_ONLY_COPY);
      expect(screen.queryByRole('switch', { name: 'Automatic imports' })).toBeNull();
    });
  });

  describe('when the server forbids saving', () => {
    beforeEach(() => {
      useSummaries([buildNotionSummary()]);
      server.use(
        http.put(`${API}/notion/settings`, () =>
          HttpResponse.json({ error: { code: 'forbidden', message: 'Write access required' } }, { status: 403 }),
        ),
      );
    });

    it('switches the page to read-only', async () => {
      renderPage();
      const input = await screen.findByLabelText('Add to Teamspaces');
      fireEvent.change(input, { target: { value: 'Design' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
      expect(await screen.findByText(READ_ONLY_COPY)).toBeTruthy();
    });
  });

  describe('when the server forbids a dry run', () => {
    beforeEach(() => {
      useSummaries([buildNotionSummary()]);
      server.use(
        http.post(`${API}/notion/dry-run`, () =>
          HttpResponse.json({ error: { code: 'forbidden', message: 'Write access required' } }, { status: 403 }),
        ),
      );
    });

    it('hides the run controls', async () => {
      renderPage();
      fireEvent.click(await screen.findByRole('button', { name: 'Dry run' }));
      await screen.findByText(READ_ONLY_COPY);
      expect(screen.queryByRole('button', { name: 'Dry run' })).toBeNull();
    });
  });
});
