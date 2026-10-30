import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { LinkComponentProvider } from '@mastra/playground-ui/lib/framework';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';
import KnowledgePage from '..';
import {
  emptyKnowledgeGraph,
  knowledgeGraph,
  knowledgeInstances,
  knowledgeTreeLevel,
  knowledgeTreeLevelWithChargebacks,
  paymentsActivity,
  paymentsPageMarkdownView,
  paymentsPageView,
  paymentsPageViewAfterEdit,
  paymentsUpdatedNotice,
  runbookSearch,
  knowledgeGraphWithDisplayLabel,
} from './fixtures/knowledge';
import { Link } from '@/lib/link';
import { stubLinkPaths } from '@/test/link-provider';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

const api = `${TEST_BASE_URL}/api/knowledge`;

const renderPage = (entry = '/knowledge') =>
  renderWithProviders(
    <TooltipProvider>
      <LinkComponentProvider Link={Link} navigate={() => {}} paths={stubLinkPaths}>
        <Routes>
          <Route path="/knowledge" element={<KnowledgePage />} />
        </Routes>
      </LinkComponentProvider>
    </TooltipProvider>,
    { router: { initialEntries: [entry] } },
  );

const withInstance = (graph = knowledgeGraph) =>
  server.use(
    http.get(api, () => HttpResponse.json(knowledgeInstances)),
    http.get(`${api}/main/graph`, () => HttpResponse.json(graph)),
    http.get(`${api}/main/tree`, ({ request }) =>
      HttpResponse.json(knowledgeTreeLevel(new URL(request.url).searchParams.get('parentId'))),
    ),
    http.get(`${api}/main/activity`, () => HttpResponse.json({ events: [] })),
    // A server on an older @mastra/core can't stream changes; the page then polls.
    http.get(`${api}/main/events`, () => HttpResponse.json({ error: 'Not implemented' }, { status: 501 })),
  );

/** An events route that stays open; `push` sends one change notice down it. */
function withChangeStream() {
  const encoder = new TextEncoder();
  let send: ((chunk: string) => void) | undefined;
  server.use(
    http.get(`${api}/main/events`, () => {
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          send = chunk => controller.enqueue(encoder.encode(chunk));
          send(': connected\n\n');
        },
      });
      return new HttpResponse(body, { headers: { 'Content-Type': 'text/event-stream' } });
    }),
  );
  return {
    connected: () => waitFor(() => expect(send).toBeDefined()),
    push: (notice: unknown) => send?.(`data: ${JSON.stringify(notice)}\n\n`),
  };
}

describe('Knowledge page', () => {
  describe('when the server has no Knowledge instances', () => {
    it('explains how to register one', async () => {
      server.use(http.get(api, () => HttpResponse.json({ instances: [] })));
      renderPage();
      expect(await screen.findByText('No Knowledge instances')).toBeTruthy();
    });
  });

  describe('when the server does not register the Knowledge routes', () => {
    it('explains how to opt into them', async () => {
      server.use(http.get(api, () => HttpResponse.json({ error: 'Not found' }, { status: 404 })));
      renderPage();
      expect(await screen.findByText('Knowledge browsing is not enabled')).toBeTruthy();
    });
  });

  describe('when the caller lacks knowledge:read', () => {
    it('shows the permission wall', async () => {
      server.use(http.get(api, () => HttpResponse.json({ error: 'Forbidden' }, { status: 403 })));
      renderPage();
      expect(await screen.findByText(/Permission Denied/i)).toBeTruthy();
    });
  });

  describe('when the instance has no pages yet', () => {
    it('says agents add them as they run', async () => {
      withInstance(emptyKnowledgeGraph);
      renderPage();
      expect(await screen.findByText('No pages yet')).toBeTruthy();
    });
  });

  describe('when the instance has pages', () => {
    it('reads the graph without asking for a scope', async () => {
      const graphQueries: string[] = [];
      withInstance();
      server.use(
        http.get(`${api}/main/graph`, ({ request }) => {
          graphQueries.push(new URL(request.url).search);
          return HttpResponse.json(knowledgeGraph);
        }),
      );
      renderPage();
      await waitFor(() => expect(graphQueries).toEqual(['']));
    });

    it('lists every page in the tree under its scope', async () => {
      withInstance();
      renderPage();
      const tree = await screen.findByRole('tree');
      expect(within(tree).getByText('Acme')).toBeTruthy();
      expect(await within(tree).findByText('Payments Service')).toBeTruthy();
      expect(within(tree).getByText('Deploy Runbook')).toBeTruthy();
    });

    it('renders the graph beside the tree', async () => {
      withInstance();
      renderPage();
      expect(await screen.findByTestId('knowledge-graph-container')).toBeTruthy();
    });
  });

  describe("when a scope's declaration has a display label", () => {
    it('captions the scope with it in the graph', async () => {
      withInstance(knowledgeGraphWithDisplayLabel());
      renderPage();
      const caption = await screen.findByTestId('knowledge-scope-caption');
      expect(caption.textContent).toBe('Organization');
    });
  });

  describe('when a page is selected in the tree', () => {
    it('opens its detail with its notes', async () => {
      withInstance();
      server.use(http.get(`${api}/main/pages/page-payments`, () => HttpResponse.json(paymentsPageView)));
      renderPage();
      fireEvent.click(await within(await screen.findByRole('tree')).findByText('Payments Service'));
      const detail = await screen.findByRole('region', { name: 'Selected page' });
      expect(await within(detail).findByText('Retries card charges three times before failing.')).toBeTruthy();
    });
  });

  describe('when a page is clicked in the graph', () => {
    const paymentsNode = async () => {
      const nodes = await screen.findAllByTestId('knowledge-page-node');
      const node = nodes.find(n => n.dataset.pageId === 'page-payments');
      if (!node) throw new Error('Payments Service not drawn');
      return node;
    };

    it('selects it on the first click and opens it on the second', async () => {
      withInstance();
      server.use(http.get(`${api}/main/pages/page-payments`, () => HttpResponse.json(paymentsPageView)));
      renderPage('/knowledge?view=graph');
      fireEvent.click(await paymentsNode());
      await waitFor(async () =>
        expect((await paymentsNode()).querySelector('.knowledge-circle')?.hasAttribute('data-selected')).toBe(true),
      );
      expect(screen.queryByRole('region', { name: 'Selected page' })).toBeNull();
      expect(screen.getByTestId('knowledge-graph-container')).toBeTruthy();

      fireEvent.click(await paymentsNode());
      const detail = await screen.findByRole('region', { name: 'Selected page' });
      expect(await within(detail).findByText('Retries card charges three times before failing.')).toBeTruthy();
    });
  });

  describe('when a linked page is opened', () => {
    it('shows it as a page with a safe markdown body, path and activity', async () => {
      withInstance();
      server.use(
        http.get(`${api}/main/pages/page-payments`, () => HttpResponse.json(paymentsPageMarkdownView)),
        http.get(`${api}/main/activity`, () => HttpResponse.json(paymentsActivity)),
      );
      renderPage('/knowledge?page=page-payments');
      const detail = await screen.findByRole('region', { name: 'Selected page' });
      expect(await within(detail).findByRole('heading', { name: 'Retries' })).toBeTruthy();
      expect(within(detail).getByText('three').tagName).toBe('STRONG');
      expect(detail.querySelector('script')).toBeNull();
      expect((window as { __injected?: boolean }).__injected).toBeUndefined();
      expect(within(detail).getByText('org:acme#payments')).toBeTruthy();
      expect(await within(detail).findByText(/updated/i)).toBeTruthy();
      expect(screen.queryByTestId('knowledge-graph-container')).toBeNull();
    });

    it('returns to the graph from the page', async () => {
      withInstance();
      server.use(http.get(`${api}/main/pages/page-payments`, () => HttpResponse.json(paymentsPageView)));
      renderPage('/knowledge?page=page-payments');
      await screen.findByRole('region', { name: 'Selected page' });
      fireEvent.click(screen.getByRole('button', { name: 'Graph' }));
      expect(await screen.findByTestId('knowledge-graph-container')).toBeTruthy();
      expect(screen.queryByRole('region', { name: 'Selected page' })).toBeNull();
    });
  });

  describe('when the server streams a change to the open page', () => {
    it('shows the new text as soon as the change arrives', async () => {
      withInstance();
      const changes = withChangeStream();
      let view = paymentsPageView;
      server.use(http.get(`${api}/main/pages/page-payments`, () => HttpResponse.json(view)));
      renderPage('/knowledge?page=page-payments');
      const detail = await screen.findByRole('region', { name: 'Selected page' });
      expect(await within(detail).findByText('Retries card charges three times before failing.')).toBeTruthy();
      await changes.connected();
      view = paymentsPageViewAfterEdit;
      changes.push(paymentsUpdatedNotice);
      // Well inside the five-second poll, so only the pushed change can explain it.
      expect(
        await within(detail).findByText('Card charges now retry five times.', {}, { timeout: 2_000 }),
      ).toBeTruthy();
    });
  });

  describe('when the server cannot stream changes and an agent edits the open page', () => {
    it('shows the new text without a reload', async () => {
      withInstance();
      let view = paymentsPageView;
      server.use(http.get(`${api}/main/pages/page-payments`, () => HttpResponse.json(view)));
      renderPage('/knowledge?page=page-payments');
      const detail = await screen.findByRole('region', { name: 'Selected page' });
      expect(await within(detail).findByText('Retries card charges three times before failing.')).toBeTruthy();
      view = paymentsPageViewAfterEdit;
      expect(
        await within(detail).findByText('Card charges now retry five times.', {}, { timeout: 8_000 }),
      ).toBeTruthy();
    }, 15_000);
  });

  describe('when the server cannot stream changes and an agent adds a page', () => {
    it('shows the new page in the tree without a reload', async () => {
      withInstance();
      let level = knowledgeTreeLevel;
      server.use(
        http.get(`${api}/main/tree`, ({ request }) =>
          HttpResponse.json(level(new URL(request.url).searchParams.get('parentId'))),
        ),
      );
      renderPage();
      const tree = await screen.findByRole('tree');
      expect(await within(tree).findByText('Payments Service')).toBeTruthy();
      level = knowledgeTreeLevelWithChargebacks;
      expect(await within(tree).findByText('Chargebacks', {}, { timeout: 8_000 })).toBeTruthy();
    }, 15_000);
  });

  describe('when the server cannot stream changes', () => {
    it('asks for the stream once and then only polls', async () => {
      withInstance();
      let streamRequests = 0;
      server.use(
        http.get(`${api}/main/events`, () => {
          streamRequests += 1;
          return HttpResponse.json({ error: 'Not implemented' }, { status: 501 });
        }),
      );
      renderPage();
      expect(await screen.findByRole('tree')).toBeTruthy();
      await new Promise(resolve => setTimeout(resolve, 6_000));
      expect(streamRequests).toBe(1);
    }, 15_000);
  });

  describe('when a link names a page that does not exist and asks for the graph', () => {
    it('says the page was not found', async () => {
      withInstance();
      server.use(
        http.get(`${api}/main/pages/page-gone`, () => HttpResponse.json({ error: 'Not found' }, { status: 404 })),
      );
      renderPage('/knowledge?page=page-gone&view=graph');
      expect((await screen.findByRole('alert')).textContent).toContain('Page not found');
    });
  });

  describe('when the selected page no longer exists', () => {
    it('says it may have been deleted or merged', async () => {
      withInstance();
      server.use(
        http.get(`${api}/main/pages/page-gone`, () => HttpResponse.json({ error: 'Not found' }, { status: 404 })),
      );
      renderPage('/knowledge?page=page-gone');
      expect(await screen.findByText('Page not found')).toBeTruthy();
    });
  });

  describe('when a search matches a page', () => {
    it('selects the page that is picked from the results', async () => {
      withInstance();
      server.use(
        http.get(`${api}/main/search`, () => HttpResponse.json(runbookSearch)),
        http.get(`${api}/main/pages/page-runbook`, () =>
          HttpResponse.json({ ...paymentsPageView, page: knowledgeGraph.pages[2], notes: [] }),
        ),
      );
      renderPage();
      fireEvent.change(await screen.findByLabelText('Search knowledge'), { target: { value: 'deploy' } });
      fireEvent.click(
        await within(await screen.findByRole('listbox')).findByRole('button', { name: 'Deploy Runbook' }),
      );
      const detail = await screen.findByRole('region', { name: 'Selected page' });
      expect(await within(detail).findByRole('heading', { name: 'Deploy Runbook' })).toBeTruthy();
    });
  });
});
