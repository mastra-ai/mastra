// @vitest-environment jsdom
import '@/test/jsdom-polyfills';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  BASE_URL,
  WORKSPACE_ID,
  WORKSPACE_URL,
  fileSearchResponse,
  listHandler,
  readHandler,
  rootListing,
  skillSearchResponse,
  srcListing,
} from '../../__tests__/fixtures/workspace';
import { WorkspaceTreeView } from '../workspace-tree-view';

const server = setupServer();

function renderView(props: { initialFile?: string } = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <WorkspaceTreeView workspaceId={WORKSPACE_ID} {...props} />
      </QueryClientProvider>
    </MastraReactProvider>,
  );
}

/** Distinct directory paths the tree asked for. */
function spyListedPaths(listings: Parameters<typeof listHandler>[0]) {
  const paths = new Set<string>();
  server.use(
    http.get(`${WORKSPACE_URL}/fs/list`, async ({ request }) => {
      const path = new URL(request.url).searchParams.get('path') ?? '/';
      paths.add(path);
      const listing = listings[path];
      return listing ? HttpResponse.json(listing) : HttpResponse.json({ error: 'nope' }, { status: 404 });
    }),
  );
  return paths;
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());

describe('WorkspaceTreeView', () => {
  describe('when the root listing is loading', () => {
    it('shows the tree skeleton', async () => {
      server.use(
        http.get(`${WORKSPACE_URL}/fs/list`, async () => {
          await delay('infinite');
          return HttpResponse.json(rootListing);
        }),
      );

      renderView();

      expect(await screen.findByTestId('workspace-tree-skeleton')).toBeTruthy();
    });
  });

  describe('when the root listing resolves', () => {
    it('shows top-level entries without fetching nested folders', async () => {
      const paths = spyListedPaths({ '/': rootListing, '/src': srcListing });

      renderView();

      const tree = await screen.findByRole('tree');
      expect(await within(tree).findByRole('treeitem', { name: 'README.md' })).toBeTruthy();
      expect(within(tree).getByRole('treeitem', { name: 'src' }).getAttribute('aria-expanded')).toBe('false');
      expect([...paths]).toEqual(['/']);
    });

    it('selects no file by default', async () => {
      server.use(listHandler({ '/': rootListing }));

      renderView();

      expect(await screen.findByText('Select a file')).toBeTruthy();
    });
  });

  describe('when the root listing fails', () => {
    it('shows an error state', async () => {
      server.use(http.get(`${WORKSPACE_URL}/fs/list`, () => HttpResponse.json({ error: 'boom' }, { status: 500 })));

      renderView();

      expect(await screen.findByText('Could not load files', {}, { timeout: 3000 })).toBeTruthy();
    });
  });

  describe('when a folder is expanded', () => {
    it('requests its path and shows its children', async () => {
      const paths = spyListedPaths({ '/': rootListing, '/src': srcListing });
      renderView();

      fireEvent.click(await screen.findByRole('treeitem', { name: 'src' }));

      expect(await screen.findByRole('treeitem', { name: 'index.ts' })).toBeTruthy();
      expect(screen.getByRole('treeitem', { name: 'src' }).getAttribute('aria-expanded')).toBe('true');
      expect([...paths]).toEqual(['/', '/src']);
    });
  });

  describe('when a file is clicked', () => {
    it('marks it active and renders it as highlighted code', async () => {
      server.use(listHandler({ '/': rootListing, '/src': srcListing }), readHandler());
      renderView();

      fireEvent.click(await screen.findByRole('treeitem', { name: 'src' }));
      const file = await screen.findByRole('treeitem', { name: 'index.ts' });
      fireEvent.click(file);

      expect(file.getAttribute('aria-selected')).toBe('true');
      expect(screen.getByTestId('workspace-file-path').textContent).toBe('/src/index.ts');
      await waitFor(() => expect(document.querySelector('.shiki-token')).toBeTruthy(), { timeout: 5000 });
    });
  });

  describe('when initialFile is a markdown file', () => {
    it('renders it as markdown without any click', async () => {
      server.use(listHandler({ '/': rootListing }), readHandler());

      renderView({ initialFile: '/README.md' });

      expect(screen.getByTestId('workspace-file-path').textContent).toBe('/README.md');
      expect(await screen.findByRole('heading', { name: 'Hello workspace' })).toBeTruthy();
      expect((await screen.findByRole('treeitem', { name: 'README.md' })).getAttribute('aria-selected')).toBe('true');
    });
  });

  describe('when the active file cannot be read', () => {
    it('shows an error state in the viewer', async () => {
      server.use(listHandler({ '/': rootListing }), readHandler());

      renderView({ initialFile: '/missing.ts' });

      expect(await screen.findByText('Could not load file', {}, { timeout: 3000 })).toBeTruthy();
    });
  });

  describe('when a search is submitted', () => {
    it('lists merged file and skill hits, and opens the clicked one', async () => {
      server.use(
        listHandler({ '/': rootListing }),
        readHandler(),
        http.get(`${WORKSPACE_URL}/search`, () => HttpResponse.json(fileSearchResponse)),
        http.get(`${WORKSPACE_URL}/skills/search`, () => HttpResponse.json(skillSearchResponse)),
      );
      renderView();

      fireEvent.change(screen.getByRole('searchbox', { name: 'Search files and skills' }), {
        target: { value: 'hello' },
      });

      const results = await screen.findByRole('list', { name: 'Search results' });
      const hits = await within(results).findAllByRole('button');
      expect(hits.map(hit => hit.textContent)).toEqual([
        expect.stringContaining('review'),
        expect.stringContaining('README.md'),
      ]);
      expect(screen.queryByRole('tree')).toBeNull();

      fireEvent.click(hits[0]);

      expect(screen.getByTestId('workspace-file-path').textContent).toBe('/skills/review/SKILL.md');
      expect(await screen.findByRole('heading', { name: 'Review skill' })).toBeTruthy();
    });
  });

  describe('when a search matches nothing', () => {
    it('shows an empty state', async () => {
      server.use(
        listHandler({ '/': rootListing }),
        http.get(`${WORKSPACE_URL}/search`, () => HttpResponse.json({ ...fileSearchResponse, results: [] })),
        http.get(`${WORKSPACE_URL}/skills/search`, () => HttpResponse.json({ ...skillSearchResponse, results: [] })),
      );
      renderView();

      fireEvent.change(screen.getByRole('searchbox', { name: 'Search files and skills' }), {
        target: { value: 'zzz' },
      });

      expect(await screen.findByText('No results')).toBeTruthy();
    });
  });
});
