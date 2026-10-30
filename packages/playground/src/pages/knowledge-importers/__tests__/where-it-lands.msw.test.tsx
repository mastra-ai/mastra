import type {
  KnowledgeImporterRoot,
  KnowledgeImporterSummary,
  SaveKnowledgeImporterSettingsParams,
} from '@mastra/client-js';
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
  buildNotionSummary,
  buildRootedNotionSummary,
  DECLARED_ROOTS,
  NOTION_KEY,
} from './fixtures/importers';
import { Link } from '@/lib/link';
import { stubLinkPaths } from '@/test/link-provider';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

const API = `${TEST_BASE_URL}/knowledge-importers`;
const NOTION = `${API}/${encodeURIComponent(NOTION_KEY)}`;
const MOVE_COPY = 'Moves everything this connection imported to External on its next run.';

const serveList = (summary: KnowledgeImporterSummary, roots?: KnowledgeImporterRoot[], canWrite = true) => {
  server.use(
    http.get(API, () => HttpResponse.json({ ...buildListImportersResponse([summary], canWrite), roots })),
    http.get(`${API}/:key/runs`, () => HttpResponse.json({ runs: [] })),
  );
};

/** Records every save and answers with the saved root at the next version. */
const recordSaves = () => {
  const saves: SaveKnowledgeImporterSettingsParams[] = [];
  server.use(
    http.put<never, SaveKnowledgeImporterSettingsParams>(`${NOTION}/settings`, async ({ request }) => {
      const body = await request.json();
      saves.push(body);
      return HttpResponse.json(
        buildRootedNotionSummary(body.root ?? 'internal', { options: body.options, version: 4 }),
      );
    }),
  );
  return saves;
};

const renderPage = () =>
  renderWithProviders(
    <TooltipProvider>
      <LinkComponentProvider Link={Link} navigate={() => {}} paths={stubLinkPaths}>
        <Routes>
          <Route path="/knowledge/importers" element={<KnowledgeImportersPage />} />
        </Routes>
        <Toaster />
      </LinkComponentProvider>
    </TooltipProvider>,
    { router: { initialEntries: [`/knowledge/importers?importer=${encodeURIComponent(NOTION_KEY)}`] } },
  );

const picker = () => screen.findByRole('radiogroup', { name: 'Where it lands' });

const save = async () =>
  fireEvent.click(
    within(await screen.findByRole('region', { name: 'Unsaved changes' })).getByRole('button', { name: 'Save' }),
  );

const chooseExternalAndSave = async () => {
  renderPage();
  fireEvent.click(within(await picker()).getByRole('radio', { name: 'External' }));
  await save();
};

describe('Where it lands', () => {
  describe('when the server declares roots', () => {
    beforeEach(() => serveList(buildRootedNotionSummary('internal'), DECLARED_ROOTS));

    it('offers every declared root by its display label', async () => {
      renderPage();
      const group = await picker();
      const inOrder = ['Internal', 'External', 'Partner portal'].map(name =>
        within(group).getByRole('radio', { name }),
      );
      expect(within(group).getAllByRole('radio')).toEqual(inOrder);
    });

    it("checks the connection's saved root", async () => {
      renderPage();
      const internal = within(await picker()).getByRole('radio', { name: 'Internal' });
      expect(internal.getAttribute('aria-checked')).toBe('true');
    });

    it("shows each root's description", async () => {
      renderPage();
      expect(within(await picker()).getByText('Knowledge shared with customers and partners.')).toBeTruthy();
    });
  });

  describe('when moving a connection to another root', () => {
    let saves: SaveKnowledgeImporterSettingsParams[];

    beforeEach(() => {
      serveList(buildRootedNotionSummary('internal'), DECLARED_ROOTS);
      saves = recordSaves();
    });

    it('asks before moving what the connection already imported', async () => {
      await chooseExternalAndSave();
      const confirm = await screen.findByRole('alertdialog');
      expect(within(confirm).getByText(MOVE_COPY)).toBeTruthy();
      expect(saves).toHaveLength(0);
    });

    it('saves the new root with the version it was based on once confirmed', async () => {
      await chooseExternalAndSave();
      fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Move and save' }));
      await waitFor(() => expect(saves).toHaveLength(1));
      expect(saves[0]).toEqual({
        enabled: true,
        schedule: null,
        options: { teamspaces: ['Engineering'] },
        root: 'external',
        expectedVersion: 3,
      });
    });

    it('saves nothing and keeps the change when cancelled', async () => {
      await chooseExternalAndSave();
      fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Cancel' }));
      await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
      expect(saves).toHaveLength(0);
      expect(screen.getByRole('region', { name: 'Unsaved changes' })).toBeTruthy();
    });
  });

  describe('when saving changes that keep the root', () => {
    let saves: SaveKnowledgeImporterSettingsParams[];

    beforeEach(() => {
      serveList(buildRootedNotionSummary('internal'), DECLARED_ROOTS);
      saves = recordSaves();
    });

    it('saves without asking and keeps the root', async () => {
      renderPage();
      fireEvent.click(await screen.findByRole('radio', { name: 'Off' }));
      await save();
      await waitFor(() => expect(saves).toHaveLength(1));
      expect(screen.queryByRole('alertdialog')).toBeNull();
      expect(saves[0]?.root).toBe('internal');
    });
  });

  describe('when someone else saved while the move was being confirmed', () => {
    beforeEach(() => {
      serveList(buildRootedNotionSummary('internal'), DECLARED_ROOTS);
      server.use(
        http.put(`${NOTION}/settings`, () =>
          HttpResponse.json(
            { error: { code: 'version_conflict', message: 'Settings changed since version 3' } },
            { status: 409 },
          ),
        ),
      );
    });

    it('reloads the latest saved settings', async () => {
      await chooseExternalAndSave();
      fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Move and save' }));
      expect(await screen.findByText('Someone else changed this — reloaded')).toBeTruthy();
    });
  });

  describe('when the saved root is no longer declared', () => {
    beforeEach(() =>
      serveList(buildRootedNotionSummary('internal', { rootFallbackFrom: 'contractors' }), DECLARED_ROOTS),
    );

    it('says the pages land in the fallback root until another is chosen', async () => {
      renderPage();
      expect(
        await screen.findByText(
          'The area this connection was saved to no longer exists, so its pages land in Internal until you choose another.',
        ),
      ).toBeTruthy();
    });
  });

  describe('when the caller cannot write', () => {
    beforeEach(() => serveList(buildRootedNotionSummary('external'), DECLARED_ROOTS, false));

    it('names the saved root without offering a choice', async () => {
      renderPage();
      expect(await screen.findByText('Lands in External.')).toBeTruthy();
      expect(screen.queryByRole('radiogroup', { name: 'Where it lands' })).toBeNull();
    });
  });

  describe('when the server declares no roots', () => {
    beforeEach(() => serveList(buildNotionSummary()));

    it('shows no root picker', async () => {
      renderPage();
      expect(await screen.findByRole('radiogroup', { name: 'Schedule' })).toBeTruthy();
      expect(screen.queryByText('Where it lands')).toBeNull();
    });
  });
});
