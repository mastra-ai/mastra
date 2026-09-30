// @vitest-environment jsdom
import '@/test/jsdom-polyfills';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  BASE_URL,
  WORKSPACE_ID,
  WORKSPACE_URL,
  fileSearchResponse,
  listHandler,
  readHandler,
  readResponse,
  rootListing,
  skillSearchResponse,
  srcListing,
} from '../../__tests__/fixtures/workspace';
import { WorkspaceTreeView } from '../workspace-tree-view';
import type { WorkspaceTreeViewProps } from '../workspace-tree-view';

const server = setupServer();

function renderView(props: Omit<WorkspaceTreeViewProps, 'workspaceId'> = {}) {
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
      const path = new URL(request.url).searchParams.get('path') ?? '.';
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
      const paths = spyListedPaths({ '.': rootListing, src: srcListing });

      renderView();

      const tree = await screen.findByRole('tree');
      expect(await within(tree).findByRole('treeitem', { name: /^README\.md/ })).toBeTruthy();
      expect(within(tree).getByRole('treeitem', { name: /^src/ }).getAttribute('aria-expanded')).toBe('false');
      expect([...paths]).toEqual(['.']);
    });

    it('selects no file by default', async () => {
      server.use(listHandler({ '.': rootListing }));

      renderView();

      expect(await screen.findByText('Select a file')).toBeTruthy();
    });
  });

  describe('when the root listing fails', () => {
    it('shows an error state', async () => {
      server.use(http.get(`${WORKSPACE_URL}/fs/list`, () => HttpResponse.json({ error: 'boom' }, { status: 500 })));

      renderView();

      expect(await screen.findByText('Could not load files.')).toBeTruthy();
    });
  });

  describe('when a folder is expanded', () => {
    it('requests its path and shows its children', async () => {
      const paths = spyListedPaths({ '.': rootListing, src: srcListing });
      renderView();

      fireEvent.click(await screen.findByRole('button', { name: /^src/ }));

      expect(await screen.findByRole('treeitem', { name: /^index\.ts/ })).toBeTruthy();
      expect(screen.getByRole('treeitem', { name: /^src/ }).getAttribute('aria-expanded')).toBe('true');
      expect([...paths]).toEqual(['.', 'src']);
    });
  });

  describe('when a file is clicked', () => {
    it('marks it active and renders it as highlighted code', async () => {
      server.use(listHandler({ '.': rootListing, src: srcListing }), readHandler());
      renderView();

      fireEvent.click(await screen.findByRole('button', { name: /^src/ }));
      const file = await screen.findByRole('treeitem', { name: /^index\.ts/ });
      fireEvent.click(file);

      expect(file.getAttribute('aria-selected')).toBe('true');
      expect(screen.getByTestId('workspace-file-path').textContent).toBe('src/index.ts');
      await waitFor(() => expect(document.querySelector('.shiki-token')).toBeTruthy(), { timeout: 5000 });
    });
  });

  describe('when initialFile is a markdown file', () => {
    it('renders it as markdown without any click', async () => {
      server.use(listHandler({ '.': rootListing }), readHandler());

      renderView({ initialFile: 'README.md' });

      expect(screen.getByTestId('workspace-file-path').textContent).toBe('README.md');
      expect(await screen.findByRole('heading', { name: 'Hello workspace' })).toBeTruthy();
      expect((await screen.findByRole('treeitem', { name: /^README\.md/ })).getAttribute('aria-selected')).toBe('true');
    });
  });

  describe('when the active file cannot be read', () => {
    it('shows an error state in the viewer', async () => {
      server.use(listHandler({ '.': rootListing }), readHandler());

      renderView({ initialFile: 'missing.ts' });

      expect(await screen.findByText('This path no longer exists.')).toBeTruthy();
    });
  });

  describe('when a search is submitted', () => {
    it('lists merged file and skill hits, and opens the clicked one', async () => {
      server.use(
        listHandler({ '.': rootListing }),
        readHandler(),
        http.get(`${WORKSPACE_URL}/search`, () => HttpResponse.json(fileSearchResponse)),
        http.get(`${WORKSPACE_URL}/skills/search`, () => HttpResponse.json(skillSearchResponse)),
      );
      renderView();

      fireEvent.click(screen.getByRole('button', { name: 'Search files and skills' }));
      fireEvent.change(screen.getByRole('searchbox', { name: 'Search query' }), {
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

      expect(screen.getByTestId('workspace-file-path').textContent).toBe('skills/review/SKILL.md');
      expect(await screen.findByRole('heading', { name: 'Review skill' })).toBeTruthy();
    });
  });

  describe('when a search matches nothing', () => {
    it('shows an empty state', async () => {
      server.use(
        listHandler({ '.': rootListing }),
        http.get(`${WORKSPACE_URL}/search`, () => HttpResponse.json({ ...fileSearchResponse, results: [] })),
        http.get(`${WORKSPACE_URL}/skills/search`, () => HttpResponse.json({ ...skillSearchResponse, results: [] })),
      );
      renderView();

      fireEvent.click(screen.getByRole('button', { name: 'Search files and skills' }));
      fireEvent.change(screen.getByRole('searchbox', { name: 'Search query' }), {
        target: { value: 'zzz' },
      });

      expect(await screen.findByText('No results')).toBeTruthy();
    });
  });

  describe('when the search is toggled', () => {
    it('hides the tree while open and restores it on close', async () => {
      server.use(listHandler({ '.': rootListing }));
      renderView();
      await screen.findByRole('tree');

      const toggle = screen.getByRole('button', { name: 'Search files and skills' });
      fireEvent.click(toggle);

      expect(screen.queryByRole('tree')).toBeNull();
      expect(screen.getByText('Type to find matching content.')).toBeTruthy();

      fireEvent.click(toggle);

      expect(await screen.findByRole('tree')).toBeTruthy();
      expect(screen.queryByRole('searchbox')).toBeNull();
    });
  });

  describe('when the listing is forbidden', () => {
    it('shows a permission notice', async () => {
      server.use(http.get(`${WORKSPACE_URL}/fs/list`, () => HttpResponse.json({ error: 'no' }, { status: 403 })));
      renderView();

      expect(await screen.findByText("You don't have permission to access this.")).toBeTruthy();
    });
  });

  describe('when the root folder does not exist yet', () => {
    it('shows the workspace as empty', async () => {
      server.use(http.get(`${WORKSPACE_URL}/fs/list`, () => HttpResponse.json({ error: 'nope' }, { status: 404 })));
      renderView();

      expect(await screen.findByText('This workspace is empty')).toBeTruthy();
      expect(screen.queryByText('This path no longer exists.')).toBeNull();
      expect(screen.queryByText('Select a file')).toBeNull();
    });
  });

  describe('when the active file is an image', () => {
    it('requests it as base64 and renders an image preview', async () => {
      const encodings: (string | null)[] = [];
      server.use(
        listHandler({ '.': rootListing }),
        http.get(`${WORKSPACE_URL}/fs/read`, ({ request }) => {
          encodings.push(new URL(request.url).searchParams.get('encoding'));
          return HttpResponse.json(readResponse('logo.png'));
        }),
      );
      renderView({ initialFile: 'logo.png' });

      const image = await screen.findByRole('img', { name: 'logo.png' });
      expect(image.getAttribute('src')).toBe('data:image/png;base64,iVBORw0KGgo=');
      expect(encodings).toContain('base64');
    });
  });

  describe('when renderPreview is provided', () => {
    it('renders its node instead of the built-in preview', async () => {
      server.use(listHandler({ '.': rootListing }), readHandler());
      renderView({ initialFile: 'README.md', renderPreview: file => <p>custom {file.content}</p> });

      expect(await screen.findByText('custom # Hello workspace')).toBeTruthy();
      expect(screen.queryByRole('heading', { name: 'Hello workspace' })).toBeNull();
    });

    it('keeps the built-in preview when it returns undefined', async () => {
      server.use(listHandler({ '.': rootListing }), readHandler());
      renderView({ initialFile: 'README.md', renderPreview: () => undefined });

      expect(await screen.findByRole('heading', { name: 'Hello workspace' })).toBeTruthy();
    });
  });

  describe('when onCreateDirectory is provided', () => {
    it('calls it with the typed path and relists the parent folder', async () => {
      let rootRequests = 0;
      server.use(
        http.get(`${WORKSPACE_URL}/fs/list`, () => {
          rootRequests += 1;
          return HttpResponse.json(rootListing);
        }),
      );
      const onCreateDirectory = vi.fn();
      renderView({ onCreateDirectory });
      await screen.findByRole('tree');

      fireEvent.click(screen.getByRole('button', { name: 'New folder' }));
      fireEvent.change(await screen.findByRole('textbox', { name: 'Folder path' }), {
        target: { value: './guides/' },
      });
      const before = rootRequests;
      fireEvent.click(screen.getByRole('button', { name: 'Create' }));

      await waitFor(() => expect(onCreateDirectory).toHaveBeenCalledWith('guides'));
      await waitFor(() => expect(rootRequests).toBeGreaterThan(before));
    });

    it('creates a folder inside the folder the user picked and relists it', async () => {
      let srcRequests = 0;
      server.use(
        http.get(`${WORKSPACE_URL}/fs/list`, ({ request }) => {
          const path = new URL(request.url).searchParams.get('path');
          if (path === 'src') {
            srcRequests += 1;
            return HttpResponse.json(srcListing);
          }
          return HttpResponse.json(rootListing);
        }),
      );
      const onCreateDirectory = vi.fn();
      renderView({ onCreateDirectory });

      fireEvent.click(await screen.findByRole('button', { name: 'New folder in src' }));
      const input = await screen.findByPlaceholderText('Folder name');
      await screen.findByRole('treeitem', { name: /^index\.ts/ });
      const before = srcRequests;
      fireEvent.change(input, { target: { value: 'utils' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      await waitFor(() => expect(onCreateDirectory).toHaveBeenCalledWith('src/utils'));
      await waitFor(() => expect(srcRequests).toBeGreaterThan(before));
      expect(screen.queryByPlaceholderText('Folder name')).toBeNull();
    });
  });

  describe('without onCreateDirectory', () => {
    it('shows no new folder action', async () => {
      server.use(listHandler({ '.': rootListing }));
      renderView();
      await screen.findByRole('tree');

      expect(screen.queryByRole('button', { name: 'New folder' })).toBeNull();
    });
  });

  describe('when onActiveFileChange is provided', () => {
    it('reports the file the user opens', async () => {
      server.use(listHandler({ '.': rootListing }), readHandler());
      const onActiveFileChange = vi.fn();
      renderView({ onActiveFileChange });

      fireEvent.click(await screen.findByRole('treeitem', { name: /^README\.md/ }));

      expect(onActiveFileChange).toHaveBeenCalledWith('README.md');
    });
  });

  describe('when a folder is read-only', () => {
    it('hides the delete action on it but keeps it elsewhere', async () => {
      server.use(listHandler({ '.': rootListing }));
      renderView({ onDelete: vi.fn(), readOnlyPaths: ['src'] });

      await screen.findByRole('treeitem', { name: /^src/ });

      expect(screen.queryByRole('button', { name: 'Delete src' })).toBeNull();
      expect(screen.getByRole('button', { name: 'Delete README.md' })).toBeTruthy();
    });
  });

  describe('when neither files nor skills are searchable', () => {
    it('shows no search action', async () => {
      server.use(listHandler({ '.': rootListing }));
      renderView({ searchFiles: false, searchSkills: false });
      await screen.findByRole('tree');

      expect(screen.queryByRole('button', { name: 'Search files and skills' })).toBeNull();
    });
  });

  describe('when onSkillSelect is provided', () => {
    it('hands skill hits to it instead of opening them', async () => {
      server.use(
        listHandler({ '.': rootListing }),
        http.get(`${WORKSPACE_URL}/search`, () => HttpResponse.json(fileSearchResponse)),
        http.get(`${WORKSPACE_URL}/skills/search`, () => HttpResponse.json(skillSearchResponse)),
      );
      const onSkillSelect = vi.fn();
      renderView({ onSkillSelect });

      fireEvent.click(screen.getByRole('button', { name: 'Search files and skills' }));
      fireEvent.change(screen.getByRole('searchbox', { name: 'Search query' }), { target: { value: 'hello' } });
      const results = await screen.findByRole('list', { name: 'Search results' });
      fireEvent.click(within(results).getByRole('button', { name: /review/ }));

      expect(onSkillSelect).toHaveBeenCalledWith({ skillName: 'review', skillPath: 'skills/review' });
      expect(screen.queryByTestId('workspace-file-path')).toBeNull();
    });
  });

  describe('when files have a size', () => {
    it('shows the formatted size on the file row', async () => {
      server.use(listHandler({ '.': rootListing }));
      renderView();

      const file = await screen.findByRole('treeitem', { name: /^README\.md/ });

      expect(within(file).getByText('20 B')).toBeTruthy();
    });
  });

  describe('when asideActions are provided', () => {
    it('renders them in the aside header', async () => {
      server.use(listHandler({ '.': rootListing }));
      renderView({ asideActions: <button type="button">New folder</button> });

      expect(await screen.findByRole('button', { name: 'New folder' })).toBeTruthy();
    });
  });

  describe('when onDelete is not provided', () => {
    it('shows no delete action', async () => {
      server.use(listHandler({ '.': rootListing }));
      renderView();

      await screen.findByRole('treeitem', { name: /^README\.md/ });

      expect(screen.queryByRole('button', { name: /^Delete / })).toBeNull();
    });
  });

  describe('when a file deletion is confirmed', () => {
    it('calls onDelete with the file, clears it from the viewer and relists its folder', async () => {
      const paths: string[] = [];
      let listing = rootListing;
      server.use(
        http.get(`${WORKSPACE_URL}/fs/list`, ({ request }) => {
          paths.push(new URL(request.url).searchParams.get('path') ?? '.');
          return HttpResponse.json(listing);
        }),
        readHandler(),
      );
      const deleted: unknown[] = [];
      renderView({
        initialFile: 'README.md',
        onDelete: async entry => {
          deleted.push(entry);
          listing = { ...rootListing, entries: rootListing.entries.filter(e => e.name !== 'README.md') };
        },
      });

      fireEvent.click(await screen.findByRole('button', { name: 'Delete README.md' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));

      await waitFor(() => expect(screen.queryByRole('treeitem', { name: /^README\.md/ })).toBeNull());
      expect(deleted).toEqual([{ path: 'README.md', type: 'file' }]);
      expect(screen.queryByTestId('workspace-file-path')).toBeNull();
      expect(new Set(paths).size).toBe(1);
      expect(paths.length).toBeGreaterThan(1);
    });
  });

  describe('when a folder deletion is confirmed', () => {
    it('calls onDelete with the directory without expanding it', async () => {
      const paths = spyListedPaths({ '.': rootListing });
      const deleted: unknown[] = [];
      renderView({ onDelete: entry => void deleted.push(entry) });

      fireEvent.click(await screen.findByRole('button', { name: 'Delete src' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));

      await waitFor(() => expect(deleted).toEqual([{ path: 'src', type: 'directory' }]));
      expect(screen.getByRole('treeitem', { name: /^src/ }).getAttribute('aria-expanded')).toBe('false');
      expect([...paths]).toEqual(['.']);
    });
  });

  describe('when a deletion is cancelled', () => {
    it('does not call onDelete', async () => {
      server.use(listHandler({ '.': rootListing }));
      const deleted: unknown[] = [];
      renderView({ onDelete: entry => void deleted.push(entry) });

      fireEvent.click(await screen.findByRole('button', { name: 'Delete README.md' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));

      await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
      expect(deleted).toEqual([]);
    });
  });
});
