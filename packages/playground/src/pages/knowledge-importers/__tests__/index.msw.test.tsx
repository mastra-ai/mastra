import type { KnowledgeImporterSummary, SaveKnowledgeImporterSettingsParams } from '@mastra/client-js';
import { Toaster } from '@mastra/playground-ui/components/Toaster';
import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { LinkComponentProvider } from '@mastra/playground-ui/lib/framework';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import KnowledgeImportersPage from '..';
import {
  buildListImportersResponse,
  buildNotionPreview,
  buildNotionSummary,
  buildRun,
  buildLinearSummary,
  NOTION_KEY,
  PLATFORM_CONNECT_URL,
} from './fixtures/importers';
import { Link } from '@/lib/link';
import { stubLinkPaths } from '@/test/link-provider';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

// Custom server routes mount at their own path, not under /api.
const API = `${TEST_BASE_URL}/knowledge-importers`;
const NOTION = `${API}/${encodeURIComponent(NOTION_KEY)}`;
const NOTION_HEADING = 'Notion — Acme workspace';
const POLL_TIMEOUT = { timeout: 5000 };
const NARROWING_COPY = 'Stops new imports. Knowledge already imported stays.';
const READ_ONLY_COPY = 'Read-only: ask an org admin';
const CONNECT_LINK = 'Add or link a connector';
const NO_CONNECT_URL_CAPTION = 'Link connectors to this project on the Mastra Platform.';

const useSummaries = (
  summaries: KnowledgeImporterSummary[],
  canWrite = true,
  connectUrl: string | null = PLATFORM_CONNECT_URL,
) => {
  server.use(
    http.get(API, () => HttpResponse.json(buildListImportersResponse(summaries, canWrite, connectUrl))),
    http.get(`${API}/:key/runs`, () => HttpResponse.json({ runs: [] })),
  );
};

const renderPage = (initialEntry = '/knowledge/importers') =>
  renderWithProviders(
    <TooltipProvider>
      <LinkComponentProvider Link={Link} navigate={() => {}} paths={stubLinkPaths}>
        <Routes>
          <Route path="/knowledge/importers" element={<KnowledgeImportersPage />} />
        </Routes>
        <Toaster />
      </LinkComponentProvider>
    </TooltipProvider>,
    { router: { initialEntries: [initialEntry] } },
  );

const addTeamspace = async (name: string) => {
  const input = await screen.findByLabelText('Add to Teamspaces');
  fireEvent.change(input, { target: { value: name } });
  fireEvent.keyDown(input, { key: 'Enter' });
};

describe('Knowledge importers page', () => {
  describe('when one connection is linked', () => {
    beforeEach(() => useSummaries([buildNotionSummary()]));

    it('opens it, named by provider and account', async () => {
      renderPage();
      expect(await screen.findByRole('heading', { name: NOTION_HEADING })).toBeTruthy();
    });

    it('shows the importer description in the detail header', async () => {
      renderPage();
      expect(
        await screen.findByText('Pages from each teamspace; each teamspace lands in its own container.'),
      ).toBeTruthy();
    });

    it('names the account under the provider in the list row', async () => {
      renderPage();
      const row = await screen.findByTestId(`importer-row-${NOTION_KEY}`);
      expect(within(row).getByText('Notion')).toBeTruthy();
      expect(within(row).getByText('Acme workspace')).toBeTruthy();
    });

    it('summarises the schedule in the list row', async () => {
      renderPage();
      const row = await screen.findByTestId(`importer-row-${NOTION_KEY}`);
      expect(within(row).getByText(/Every 15 min · last run/)).toBeTruthy();
    });

    it('has no group for unlinked importers', async () => {
      renderPage();
      await screen.findByTestId(`importer-row-${NOTION_KEY}`);
      expect(screen.queryByText(/Not connected/)).toBeNull();
    });

    it('offers no connection picker', async () => {
      renderPage();
      await screen.findByRole('heading', { name: NOTION_HEADING });
      expect(screen.queryByRole('combobox', { name: /connection/i })).toBeNull();
    });
  });

  describe('when the project links two Linear accounts with the same name and one with its own', () => {
    let savedTo: string[];

    beforeEach(() => {
      savedTo = [];
      useSummaries([
        buildLinearSummary('conn_01JA948KS', 'Mastra'),
        buildLinearSummary('conn_01JB71Q2Z', 'Mastra'),
        buildLinearSummary('conn_01JCXYZ00', 'Acme'),
      ]);
      server.use(
        http.put(`${API}/:key/settings`, ({ params }) => {
          savedTo.push(String(params.key));
          return HttpResponse.json(
            buildLinearSummary('conn_01JB71Q2Z', 'Mastra', {
              settings: {
                ...buildLinearSummary('conn_01JB71Q2Z', 'Mastra').settings,
                enabled: true,
                schedule: '0 * * * *',
                version: 1,
                source: 'saved',
              },
            }),
          );
        }),
      );
    });

    it('lists one entry per connection', async () => {
      renderPage();
      const nav = await screen.findByRole('navigation', { name: 'Importers' });
      expect(within(nav).getAllByRole('button', { name: /Linear/ })).toHaveLength(3);
    });

    it('tells same-named accounts apart by the end of the connection id', async () => {
      renderPage();
      expect(
        within(await screen.findByTestId('importer-row-linear:conn_01JA948KS')).getByText('Mastra · …A948KS'),
      ).toBeTruthy();
      expect(
        within(screen.getByTestId('importer-row-linear:conn_01JB71Q2Z')).getByText('Mastra · …B71Q2Z'),
      ).toBeTruthy();
    });

    it('shows a uniquely named account as is', async () => {
      renderPage();
      const row = await screen.findByTestId('importer-row-linear:conn_01JCXYZ00');
      expect(within(row).getByText('Acme')).toBeTruthy();
    });

    it('names the provider, account and connection in the detail header', async () => {
      renderPage();
      expect(await screen.findByRole('heading', { name: 'Linear — Mastra (…A948KS)' })).toBeTruthy();
    });

    it('opens the entry the address names', async () => {
      renderPage('/knowledge/importers?importer=linear%3Aconn_01JB71Q2Z');
      expect(await screen.findByRole('heading', { name: 'Linear — Mastra (…B71Q2Z)' })).toBeTruthy();
    });

    it('opens another entry when its row is chosen', async () => {
      renderPage();
      fireEvent.click(await screen.findByTestId('importer-row-linear:conn_01JCXYZ00'));
      expect(await screen.findByRole('heading', { name: 'Linear — Acme' })).toBeTruthy();
    });

    it("saves to the chosen connection's own settings", async () => {
      renderPage('/knowledge/importers?importer=linear%3Aconn_01JB71Q2Z');
      fireEvent.click(await screen.findByRole('radio', { name: /Hourly/ }));
      fireEvent.click(
        within(await screen.findByRole('region', { name: 'Unsaved changes' })).getByRole('button', { name: 'Save' }),
      );
      await waitFor(() => expect(savedTo).toEqual(['linear:conn_01JB71Q2Z']));
    });
  });

  describe('when a linked connection needs re-auth', () => {
    beforeEach(() =>
      useSummaries([
        buildNotionSummary({
          connection: { id: 'conn_notion', status: 'needs_reauth', accountName: 'Acme workspace' },
        }),
      ]),
    );

    it('still lists the importer and says why it needs attention', async () => {
      renderPage();
      const row = await screen.findByTestId(`importer-row-${NOTION_KEY}`);
      expect(within(row).getByText(/^Connection needs re-auth/)).toBeTruthy();
    });
  });

  describe('when the server knows the Platform Connect page', () => {
    beforeEach(() => useSummaries([buildNotionSummary()]));

    it('links to it from the sidebar', async () => {
      renderPage();
      const nav = await screen.findByRole('navigation', { name: 'Importers' });
      const link = within(nav).getByRole('link', { name: CONNECT_LINK });
      expect(link.getAttribute('href')).toBe(PLATFORM_CONNECT_URL);
    });

    it('opens it in a new tab without handing over the opener', async () => {
      renderPage();
      const link = await screen.findByRole('link', { name: CONNECT_LINK });
      expect(link.getAttribute('target')).toBe('_blank');
      expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    });
  });

  describe('when the server has no Platform Connect page', () => {
    beforeEach(() => useSummaries([buildNotionSummary()], true, null));

    it('says where to link connectors', async () => {
      renderPage();
      expect(await screen.findByText(NO_CONNECT_URL_CAPTION)).toBeTruthy();
    });

    it('offers no link', async () => {
      renderPage();
      await screen.findByText(NO_CONNECT_URL_CAPTION);
      expect(screen.queryByRole('link', { name: CONNECT_LINK })).toBeNull();
    });
  });

  describe('when the address names an importer that is not linked', () => {
    beforeEach(() => useSummaries([buildNotionSummary()]));

    it('opens the first linked importer instead', async () => {
      renderPage('/knowledge/importers?importer=slack');
      expect(await screen.findByRole('heading', { name: NOTION_HEADING })).toBeTruthy();
    });
  });

  describe('when no importer is linked to this project', () => {
    beforeEach(() => useSummaries([]));

    it('says no connectors are linked yet', async () => {
      renderPage();
      expect(await screen.findByText('No connectors are linked to this project yet.')).toBeTruthy();
    });

    it('offers the Platform Connect link', async () => {
      renderPage();
      const link = await screen.findByRole('link', { name: CONNECT_LINK });
      expect(link.getAttribute('href')).toBe(PLATFORM_CONNECT_URL);
    });

    it('lists no importers', async () => {
      renderPage();
      await screen.findByText('No connectors are linked to this project yet.');
      expect(screen.queryByRole('navigation', { name: 'Importers' })).toBeNull();
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

    it('says the importer imports nothing until an entry is added', async () => {
      renderPage();
      expect(await screen.findByText('Imports nothing until you add teamspaces.')).toBeTruthy();
    });
  });

  describe('when the settings have not been edited', () => {
    beforeEach(() => useSummaries([buildNotionSummary()]));

    it('shows no save bar', async () => {
      renderPage();
      await screen.findByLabelText('Add to Teamspaces');
      expect(screen.queryByRole('region', { name: 'Unsaved changes' })).toBeNull();
    });

    it('does not warn about narrowing', async () => {
      renderPage();
      await screen.findByLabelText('Add to Teamspaces');
      expect(screen.queryByText(NARROWING_COPY)).toBeNull();
    });
  });

  describe('when a saved allowlist entry is removed', () => {
    beforeEach(() => useSummaries([buildNotionSummary()]));

    it('says narrowing keeps knowledge already imported', async () => {
      renderPage();
      fireEvent.click(await screen.findByRole('button', { name: 'Remove Engineering' }));
      expect(await screen.findByText(NARROWING_COPY)).toBeTruthy();
    });
  });

  describe('when the schedule is switched off', () => {
    beforeEach(() => useSummaries([buildNotionSummary()]));

    it('says knowledge already imported stays', async () => {
      renderPage();
      fireEvent.click(await screen.findByRole('radio', { name: 'Off' }));
      expect(await screen.findByText(`Off — only manual imports. ${NARROWING_COPY}`)).toBeTruthy();
    });

    it('offers to save the change', async () => {
      renderPage();
      fireEvent.click(await screen.findByRole('radio', { name: 'Off' }));
      expect(await screen.findByRole('region', { name: 'Unsaved changes' })).toBeTruthy();
    });
  });

  describe('when a custom cron expression is invalid', () => {
    beforeEach(() => useSummaries([buildNotionSummary()]));

    it('explains the problem inline', async () => {
      renderPage();
      fireEvent.click(await screen.findByRole('radio', { name: 'Custom' }));
      fireEvent.change(screen.getByLabelText('Cron expression'), { target: { value: '0 25 * * *' } });
      expect(await screen.findByText(/Hour must be 0–23/)).toBeTruthy();
    });

    it('disables saving', async () => {
      renderPage();
      fireEvent.click(await screen.findByRole('radio', { name: 'Custom' }));
      fireEvent.change(screen.getByLabelText('Cron expression'), { target: { value: '0 25 * * *' } });
      const bar = await screen.findByRole('region', { name: 'Unsaved changes' });
      expect(within(bar).getByRole('button', { name: 'Save' })).toHaveProperty('disabled', true);
    });
  });

  describe('when saving and nobody else changed the settings', () => {
    let saved: SaveKnowledgeImporterSettingsParams | undefined;

    beforeEach(() => {
      saved = undefined;
      useSummaries([buildNotionSummary()]);
      server.use(
        http.put<never, SaveKnowledgeImporterSettingsParams>(`${NOTION}/settings`, async ({ request }) => {
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
      await addTeamspace('Design');
      fireEvent.click(
        within(await screen.findByRole('region', { name: 'Unsaved changes' })).getByRole('button', { name: 'Save' }),
      );

      await waitFor(() => expect(saved).toBeDefined());
      expect(saved).toEqual({
        enabled: true,
        schedule: null,
        options: { teamspaces: ['Engineering', 'Design'] },
        expectedVersion: 3,
      });
    });

    it('clears the save bar once saved', async () => {
      renderPage();
      await addTeamspace('Design');
      fireEvent.click(
        within(await screen.findByRole('region', { name: 'Unsaved changes' })).getByRole('button', { name: 'Save' }),
      );
      await waitFor(() => expect(screen.queryByRole('region', { name: 'Unsaved changes' })).toBeNull());
    });
  });

  describe('when discarding unsaved changes', () => {
    beforeEach(() => useSummaries([buildNotionSummary()]));

    it('restores the saved allowlist', async () => {
      renderPage();
      await addTeamspace('Design');
      fireEvent.click(
        within(await screen.findByRole('region', { name: 'Unsaved changes' })).getByRole('button', { name: 'Discard' }),
      );
      const entries = screen.getByRole('list', { name: 'Teamspaces entries' });
      await waitFor(() => expect(within(entries).queryByText('Design')).toBeNull());
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
        http.put(`${NOTION}/settings`, () =>
          HttpResponse.json(
            { error: { code: 'version_conflict', message: 'Settings changed since version 3' } },
            { status: 409 },
          ),
        ),
      );
    });

    const saveEdit = async () => {
      renderPage();
      await addTeamspace('Design');
      fireEvent.click(
        within(await screen.findByRole('region', { name: 'Unsaved changes' })).getByRole('button', { name: 'Save' }),
      );
    };

    it('tells the user someone else changed it', async () => {
      await saveEdit();
      expect(await screen.findByText('Someone else changed this — reloaded')).toBeTruthy();
    });

    it('reloads the form with the latest saved values', async () => {
      await saveEdit();
      const entries = await screen.findByRole('list', { name: 'Teamspaces entries' });
      await waitFor(() => expect(within(entries).getByText('Sales')).toBeTruthy());
    });
  });

  describe('when a preview of unsaved settings succeeds', () => {
    let dryRunBody: unknown;
    let polls = 0;

    beforeEach(() => {
      dryRunBody = undefined;
      polls = 0;
      useSummaries([buildNotionSummary()]);
      server.use(
        http.post(`${NOTION}/dry-run`, async ({ request }) => {
          dryRunBody = await request.json();
          return HttpResponse.json({ runId: 'run_dry' }, { status: 202 });
        }),
        http.get(`${API}/runs/run_dry`, () => {
          polls += 1;
          return HttpResponse.json(polls === 1 ? buildRun() : buildNotionPreview());
        }),
      );
    });

    const startPreview = async () => {
      renderPage();
      await addTeamspace('Design');
      fireEvent.click(screen.getByRole('button', { name: 'Preview import' }));
    };

    it('previews the unsaved form values', async () => {
      await startPreview();
      await waitFor(() => expect(dryRunBody).toBeDefined());
      expect(dryRunBody).toEqual({
        settings: {
          enabled: true,
          schedule: null,
          options: { teamspaces: ['Engineering', 'Design'] },
        },
      });
    });

    it('shows progress while the preview runs', async () => {
      await startPreview();
      expect(await screen.findByTestId('run-in-progress')).toBeTruthy();
    });

    it('polls until the preview settles and says what it would import', async () => {
      await startPreview();
      expect(
        await screen.findByText('Would import 12 pages and 30 records · 3 items skipped', undefined, POLL_TIMEOUT),
      ).toBeTruthy();
    });

    it('names where each part lands without claiming who can read it', async () => {
      await startPreview();
      const destinations = await screen.findByRole('list', { name: 'Destinations' }, POLL_TIMEOUT);
      expect(
        ['Org-wide area', 'Own container: Engineering'].map(copy => within(destinations).queryByText(copy) !== null),
      ).toEqual([true, true]);
    });

    it('lists sample page titles for each destination', async () => {
      await startPreview();
      const samples = await screen.findByRole('list', { name: 'Sample pages in Engineering' }, POLL_TIMEOUT);
      expect(within(samples).getByText('Release checklist')).toBeTruthy();
    });

    it('explains skipped items in plain words', async () => {
      await startPreview();
      const skipped = await screen.findByRole('list', { name: 'Skipped items' }, POLL_TIMEOUT);
      expect(within(skipped).getByText('Private Notion pages are never imported')).toBeTruthy();
    });
  });

  describe('when a preview fails', () => {
    beforeEach(() => {
      useSummaries([buildNotionSummary()]);
      server.use(
        http.post(`${NOTION}/dry-run`, () => HttpResponse.json({ runId: 'run_dry' }, { status: 202 })),
        http.get(`${API}/runs/run_dry`, () =>
          HttpResponse.json(
            buildRun({ status: 'failed', completedAt: '2026-10-29T13:00:01.000Z', error: 'Notion API returned 401' }),
          ),
        ),
      );
    });

    it('shows the run error', async () => {
      renderPage();
      fireEvent.click(await screen.findByRole('button', { name: 'Preview import' }));
      const report = await screen.findByTestId('run-report', undefined, POLL_TIMEOUT);
      expect(within(report).getByText('Notion API returned 401')).toBeTruthy();
    });
  });

  describe('when an import is already in progress', () => {
    beforeEach(() => {
      useSummaries([buildNotionSummary()]);
      server.use(
        http.post(`${NOTION}/dry-run`, () =>
          HttpResponse.json({ error: { code: 'run_in_progress', message: 'busy' } }, { status: 409 }),
        ),
      );
    });

    it('explains that an import is already running', async () => {
      renderPage();
      fireEvent.click(await screen.findByRole('button', { name: 'Preview import' }));
      expect(
        await screen.findByText('An import is already running for this importer. Wait for it to finish.'),
      ).toBeTruthy();
    });
  });

  describe('when importing now after a preview', () => {
    let runStarted = false;

    beforeEach(() => {
      runStarted = false;
      useSummaries([buildNotionSummary()]);
      server.use(
        http.get(`${NOTION}/runs`, () => HttpResponse.json({ runs: [buildNotionPreview()] })),
        http.post(`${NOTION}/run`, () => {
          runStarted = true;
          return HttpResponse.json({ runId: 'run_real' }, { status: 202 });
        }),
        http.get(`${API}/runs/run_real`, () =>
          HttpResponse.json(buildRun({ id: 'run_real', kind: 'run', status: 'running' })),
        ),
      );
    });

    it('names where the last preview put pages before importing', async () => {
      renderPage();
      fireEvent.click(await screen.findByRole('button', { name: 'Import now' }));
      const dialog = await screen.findByRole('alertdialog');
      expect(within(dialog).getByText(/Notion · Wiki \(5 pages\), Engineering \(7 pages\)/)).toBeTruthy();
    });

    it('starts the import once confirmed', async () => {
      renderPage();
      fireEvent.click(await screen.findByRole('button', { name: 'Import now' }));
      fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Import now' }));
      await waitFor(() => expect(runStarted).toBe(true));
    });
  });

  describe('when the settings have unsaved changes', () => {
    beforeEach(() => useSummaries([buildNotionSummary()]));

    it('holds back importing until they are saved', async () => {
      renderPage();
      await addTeamspace('Design');
      expect(screen.getByRole('button', { name: 'Import now' })).toHaveProperty('disabled', true);
    });
  });

  describe('when the caller cannot write', () => {
    beforeEach(() => useSummaries([buildNotionSummary()], false));

    it('says the page is read-only', async () => {
      renderPage();
      expect(await screen.findByText(READ_ONLY_COPY)).toBeTruthy();
    });

    it('hides preview, import and reset', async () => {
      renderPage();
      await screen.findByText(READ_ONLY_COPY);
      const names = ['Preview import', 'Import now', 'Reset to environment defaults'];
      expect(names.filter(name => screen.queryByRole('button', { name }))).toEqual([]);
    });

    it('shows the schedule as text instead of a control', async () => {
      renderPage();
      await screen.findByText(READ_ONLY_COPY);
      expect(screen.queryByRole('radiogroup', { name: 'Schedule' })).toBeNull();
    });
  });

  describe('when the server forbids saving', () => {
    beforeEach(() => {
      useSummaries([buildNotionSummary()]);
      server.use(
        http.put(`${NOTION}/settings`, () =>
          HttpResponse.json({ error: { code: 'forbidden', message: 'Write access required' } }, { status: 403 }),
        ),
      );
    });

    it('switches the page to read-only', async () => {
      renderPage();
      await addTeamspace('Design');
      fireEvent.click(
        within(await screen.findByRole('region', { name: 'Unsaved changes' })).getByRole('button', { name: 'Save' }),
      );
      expect(await screen.findByText(READ_ONLY_COPY)).toBeTruthy();
    });
  });

  describe('when the server forbids a preview', () => {
    beforeEach(() => {
      useSummaries([buildNotionSummary()]);
      server.use(
        http.post(`${NOTION}/dry-run`, () =>
          HttpResponse.json({ error: { code: 'forbidden', message: 'Write access required' } }, { status: 403 }),
        ),
      );
    });

    it('hides the import controls', async () => {
      renderPage();
      fireEvent.click(await screen.findByRole('button', { name: 'Preview import' }));
      await screen.findByText(READ_ONLY_COPY);
      expect(screen.queryByRole('button', { name: 'Preview import' })).toBeNull();
    });
  });
});
