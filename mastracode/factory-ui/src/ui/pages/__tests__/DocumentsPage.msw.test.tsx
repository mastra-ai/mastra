/**
 * DocumentsPage — the factory document inventory synced from docs/factory:
 * every catalog kind as a row (present / missing / too large), the selected
 * document rendered as markdown, deep links via `?doc=`, and an explicit
 * refresh through the server.
 */
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../e2e/ui/render';
import type { FactoryDocument, FactoryDocumentsResponse } from '../../../api/types';
import { createAppRoutes } from '../../router';

const FACTORY_ID = 'fp-1';
const LIST_URL = `${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/documents`;

const architecture: FactoryDocument = {
  id: 'doc-architecture',
  kind: 'architecture',
  path: 'docs/factory/architecture.md',
  title: 'System Architecture',
  summary: 'Two services behind one gateway.',
  status: 'present',
  contentHash: 'h1',
  sizeBytes: 120,
  sourceRef: 'origin/main',
  sourceSha: 'abcdef1234567',
  syncedAt: '2026-09-01T00:00:00.000Z',
};

const runbook: FactoryDocument = {
  ...architecture,
  id: 'doc-runbook',
  kind: 'runbook',
  path: 'docs/factory/runbook.md',
  title: 'Runbook',
  status: 'oversize',
  sizeBytes: 400_000,
};

const inventory: FactoryDocumentsResponse = {
  docsRoot: 'docs/factory',
  manifestPath: 'docs/factory/manifest.yaml',
  catalog: [
    {
      kind: 'product-vision',
      group: 'ba',
      label: 'Product vision / PRD',
      defaultPath: 'docs/factory/product-vision.md',
      purpose: 'Why the product exists.',
    },
    { kind: 'glossary', group: 'ba', label: 'Glossary', defaultPath: 'docs/factory/glossary.md', purpose: 'Terms.' },
    {
      kind: 'architecture',
      group: 'tech',
      label: 'Architecture overview',
      defaultPath: 'docs/factory/architecture.md',
      purpose: 'Components and flows.',
    },
    {
      kind: 'runbook',
      group: 'tech',
      label: 'Runbook / deployment',
      defaultPath: 'docs/factory/runbook.md',
      purpose: 'Ops.',
    },
  ],
  // glossary is deliberately absent from the sync: the page must still list it.
  documents: [
    {
      ...architecture,
      id: 'doc-pv',
      kind: 'product-vision',
      path: 'docs/factory/product-vision.md',
      title: null,
      status: 'missing',
    },
    architecture,
    runbook,
  ],
  sync: {
    sourceRef: 'origin/main',
    sourceSha: 'abcdef1234567',
    manifestStatus: 'ok',
    syncedAt: '2026-09-01T00:00:00.000Z',
  },
};

function stubShell() {
  server.use(
    http.get(`${TEST_BASE_URL}/auth/me`, () =>
      HttpResponse.json({ authenticated: true, authEnabled: true, user: { userId: 'user-1' } }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
      HttpResponse.json({ projects: [{ id: FACTORY_ID, name: 'Acme Factory' }] }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-records`, () =>
      HttpResponse.json({ workRecords: [] }),
    ),
    http.get(`${TEST_BASE_URL}/web/github/subscriptions`, () => HttpResponse.json({ subscriptions: [] })),
    http.get(`${TEST_BASE_URL}/api/agent-controller/code/sessions/:resourceId/permissions`, () =>
      HttpResponse.json({}),
    ),
  );
}

function stubDocuments(
  list: FactoryDocumentsResponse | { status: number; message: string } = inventory,
  options: { detailRequests?: string[]; refresh?: () => Response } = {},
) {
  stubShell();
  server.use(
    http.get(LIST_URL, () =>
      'status' in list
        ? HttpResponse.json({ error: 'error', message: list.message }, { status: list.status })
        : HttpResponse.json(list),
    ),
    http.get(`${LIST_URL}/:kind`, ({ params }) => {
      const kind = String(params.kind);
      options.detailRequests?.push(kind);
      if (kind === 'architecture') {
        return HttpResponse.json({
          document: { ...architecture, content: '# System Architecture\n\nTwo services behind one gateway.' },
        });
      }
      if (kind === 'runbook') return HttpResponse.json({ document: { ...runbook, content: null } });
      return HttpResponse.json({ error: 'Document not found' }, { status: 404 });
    }),
    http.post(`${LIST_URL}/refresh`, () =>
      options.refresh ? options.refresh() : HttpResponse.json({ ok: true, outcome: 'synced', sync: inventory.sync }),
    ),
  );
}

function renderRoute(path = `/factories/${FACTORY_ID}/docs`) {
  const router = createMemoryRouter(createAppRoutes(), { initialEntries: [path] });
  return { router, ...renderWithProviders(<RouterProvider router={router} />) };
}

describe('DocumentsPage', () => {
  describe('given the sidebar', () => {
    it('shows a Documents entry under Audit log even when knowledge is disabled', async () => {
      stubDocuments();
      renderRoute();

      const docsLink = await screen.findByRole('link', { name: 'Documents' });
      expect(docsLink).toHaveAttribute('href', `/factories/${FACTORY_ID}/docs`);
      const auditLink = screen.getByRole('link', { name: 'Audit log' });
      expect(auditLink.compareDocumentPosition(docsLink) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(screen.queryByRole('link', { name: 'Knowledge' })).not.toBeInTheDocument();
    });
  });

  describe('given a synced inventory', () => {
    it('lists every catalog kind by group with its status, including kinds the sync omitted', async () => {
      stubDocuments();
      renderRoute();

      const business = await screen.findByRole('region', { name: 'Business documents' });
      const technical = screen.getByRole('region', { name: 'Technical documents' });
      expect(within(business).getByRole('button', { name: /Product vision \/ PRD/ })).toHaveTextContent('missing');
      expect(within(business).getByRole('button', { name: /Glossary/ })).toHaveTextContent('missing');
      expect(within(business).getByText('0 of 2 present')).toBeInTheDocument();
      const architectureRow = within(technical).getByRole('button', { name: /System Architecture/ });
      expect(architectureRow).toHaveTextContent('present');
      expect(architectureRow).toHaveTextContent('docs/factory/architecture.md');
      expect(within(technical).getByRole('button', { name: /Runbook/ })).toHaveTextContent('too large');
      expect(within(technical).getByText('2 of 2 present')).toBeInTheDocument();
      expect(screen.getByText(/^Synced /)).toBeInTheDocument();
    });

    it('renders the selected document as markdown and records the selection in the URL', async () => {
      const detailRequests: string[] = [];
      stubDocuments(inventory, { detailRequests });
      const { router } = renderRoute();

      await userEvent.click(await screen.findByRole('button', { name: /System Architecture/ }));

      const article = await screen.findByRole('article', { name: 'System Architecture' });
      expect(within(article).getByRole('heading', { level: 1, name: 'System Architecture' })).toBeInTheDocument();
      expect(within(article).getByText('Two services behind one gateway.')).toBeInTheDocument();
      expect(router.state.location.search).toBe('?doc=architecture');
      expect(detailRequests).toEqual(['architecture']);
      expect(screen.getByRole('button', { name: /System Architecture/ })).toHaveAttribute('aria-pressed', 'true');
    });

    it('explains a missing document without fetching it', async () => {
      const detailRequests: string[] = [];
      stubDocuments(inventory, { detailRequests });
      renderRoute();

      await userEvent.click(await screen.findByRole('button', { name: /Glossary/ }));

      expect(await screen.findByRole('heading', { name: 'Glossary is not in the repository yet' })).toBeInTheDocument();
      expect(screen.getByText('docs/factory/glossary.md', { selector: 'code' })).toBeInTheDocument();
      expect(screen.getByText(/Agents create and update it in the same branch/)).toBeInTheDocument();
      expect(detailRequests).toEqual([]);
    });

    it('opens a deep-linked document on load and flags an oversize body', async () => {
      stubDocuments();
      renderRoute(`/factories/${FACTORY_ID}/docs?doc=runbook`);

      const article = await screen.findByRole('article', { name: 'Runbook' });
      expect(within(article).getByText(/too large to store in the index/)).toBeInTheDocument();
      expect(within(article).getByText(/391 KiB/)).toBeInTheDocument();
    });
  });

  describe('given a refresh', () => {
    it('posts the refresh, shows it pending, and picks up the new inventory', async () => {
      let refreshed = false;
      stubShell();
      server.use(
        http.get(LIST_URL, () =>
          HttpResponse.json(
            refreshed
              ? {
                  ...inventory,
                  documents: [
                    ...inventory.documents,
                    {
                      ...architecture,
                      id: 'doc-glossary',
                      kind: 'glossary',
                      path: 'docs/factory/glossary.md',
                      title: 'Glossary',
                    },
                  ],
                  sync: { ...inventory.sync!, syncedAt: '2026-09-02T00:00:00.000Z' },
                }
              : inventory,
          ),
        ),
        http.post(`${LIST_URL}/refresh`, () => {
          refreshed = true;
          return HttpResponse.json({
            ok: true,
            outcome: 'synced',
            sync: { ...inventory.sync!, syncedAt: '2026-09-02T00:00:00.000Z' },
          });
        }),
      );
      renderRoute();

      const business = await screen.findByRole('region', { name: 'Business documents' });
      expect(within(business).getByRole('button', { name: /Glossary/ })).toHaveTextContent('missing');

      await userEvent.click(screen.getByRole('button', { name: 'Refresh documents' }));

      await waitFor(() =>
        expect(within(business).getByRole('button', { name: /Glossary/ })).toHaveTextContent('present'),
      );
      expect(refreshed).toBe(true);
      await waitFor(() => expect(screen.getByRole('button', { name: 'Refresh documents' })).toBeEnabled());
    });

    it('surfaces a refresh conflict calmly and keeps the inventory', async () => {
      stubDocuments(inventory, {
        refresh: () =>
          HttpResponse.json(
            { error: 'no_active_sandbox', message: 'No running sandbox holds this repository.' },
            { status: 409 },
          ),
      });
      renderRoute();

      await screen.findByRole('region', { name: 'Business documents' });
      await userEvent.click(screen.getByRole('button', { name: 'Refresh documents' }));

      expect(await screen.findByText('No running sandbox holds this repository.')).toBeInTheDocument();
      expect(screen.getByRole('region', { name: 'Business documents' })).toBeInTheDocument();
    });
  });

  describe('given the server cannot answer', () => {
    it('shows the load error as a notice', async () => {
      stubDocuments({ status: 503, message: 'Factory storage is unavailable.' });
      renderRoute();

      expect(await screen.findByText('Factory storage is unavailable.')).toBeInTheDocument();
    });

    it('renders the full missing inventory before the first sync', async () => {
      stubDocuments({ ...inventory, documents: [], sync: null });
      renderRoute();

      const business = await screen.findByRole('region', { name: 'Business documents' });
      expect(within(business).getAllByRole('button')).toHaveLength(2);
      expect(screen.getByText(/Not synced yet/)).toBeInTheDocument();
      expect(screen.getByRole('region', { name: 'Technical documents' })).toHaveTextContent('0 of 2 present');
    });
  });
});
