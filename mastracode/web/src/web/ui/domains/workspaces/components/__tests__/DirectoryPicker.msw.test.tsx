import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { server } from '../../../../../../../e2e/web-ui/msw-server';
import { TEST_BASE_URL, renderWithProviders } from '../../../../../../../e2e/web-ui/render';
import type { DirectoryListing } from '../../../../../../shared/api/types';
import { DirectoryBrowser } from '../DirectoryPicker';

const FS_URL = `${TEST_BASE_URL}/web/fs/list`;

const rootListing: DirectoryListing = {
  root: '/projects',
  path: '/projects',
  parent: null,
  entries: [
    { name: 'alpha', path: '/projects/alpha' },
    { name: 'beta', path: '/projects/beta' },
  ],
};

const alphaListing: DirectoryListing = {
  root: '/projects',
  path: '/projects/alpha',
  parent: '/projects',
  entries: [{ name: 'src', path: '/projects/alpha/src' }],
};

function listingFor(path: string | null): DirectoryListing {
  if (path === '/projects/alpha') return alphaListing;
  return rootListing;
}

describe('DirectoryBrowser', () => {
  describe('while the listing is loading', () => {
    it('renders a skeleton placeholder instead of loading text', async () => {
      server.use(
        http.get(FS_URL, async () => {
          await delay(150);
          return HttpResponse.json(rootListing);
        }),
      );

      renderWithProviders(<DirectoryBrowser onPick={vi.fn()} onCancel={vi.fn()} />);

      expect(await screen.findByRole('status', { name: 'Loading folders' })).toBeInTheDocument();
      expect(screen.queryByText('Loading…')).not.toBeInTheDocument();

      expect(await screen.findByText('alpha')).toBeInTheDocument();
      expect(screen.queryByRole('status', { name: 'Loading folders' })).not.toBeInTheDocument();
    });
  });

  describe('when it opens', () => {
    it('lists the server root', async () => {
      server.use(
        http.get(FS_URL, ({ request }) => HttpResponse.json(listingFor(new URL(request.url).searchParams.get('path')))),
      );

      renderWithProviders(<DirectoryBrowser onPick={vi.fn()} onCancel={vi.fn()} />);

      expect(await screen.findByText('alpha')).toBeInTheDocument();
      expect(screen.getByText('beta')).toBeInTheDocument();
    });
  });

  describe('when a folder is clicked', () => {
    it('navigates into it and shows its children', async () => {
      server.use(
        http.get(FS_URL, ({ request }) => HttpResponse.json(listingFor(new URL(request.url).searchParams.get('path')))),
      );

      const user = userEvent.setup();
      renderWithProviders(<DirectoryBrowser onPick={vi.fn()} onCancel={vi.fn()} />);

      await user.click(await screen.findByText('alpha'));

      expect(await screen.findByText('src')).toBeInTheDocument();

      // go back up via the breadcrumb, not an "Up a level" entry
      await user.click(screen.getByRole('button', { name: 'projects' }));
      expect(await screen.findByText('beta')).toBeInTheDocument();
    });
  });

  describe('when navigating folder history', () => {
    it('moves backward and forward through visited folders', async () => {
      server.use(
        http.get(FS_URL, ({ request }) => HttpResponse.json(listingFor(new URL(request.url).searchParams.get('path')))),
      );

      const user = userEvent.setup();
      renderWithProviders(<DirectoryBrowser onPick={vi.fn()} onCancel={vi.fn()} />);

      const back = screen.getByRole('button', { name: 'Back' });
      const forward = screen.getByRole('button', { name: 'Forward' });
      expect(back).toBeDisabled();
      expect(forward).toBeDisabled();

      await user.click(await screen.findByText('alpha'));
      expect(await screen.findByText('src')).toBeInTheDocument();
      expect(back).toBeEnabled();
      expect(forward).toBeDisabled();

      await user.click(back);
      expect(await screen.findByText('beta')).toBeInTheDocument();
      expect(back).toBeDisabled();
      expect(forward).toBeEnabled();

      await user.click(forward);
      expect(await screen.findByText('src')).toBeInTheDocument();
    });
  });

  describe('while navigation is loading', () => {
    it('keeps the breadcrumb mounted with the current listing', async () => {
      server.use(
        http.get(FS_URL, async ({ request }) => {
          const path = new URL(request.url).searchParams.get('path');
          if (path === '/projects/alpha') await delay(150);
          return HttpResponse.json(listingFor(path));
        }),
      );

      const user = userEvent.setup();
      renderWithProviders(<DirectoryBrowser onPick={vi.fn()} onCancel={vi.fn()} />);

      await screen.findByText('alpha');
      const breadcrumb = screen.getByRole('navigation', { name: 'Path' });
      await user.click(screen.getByText('alpha'));

      expect(screen.getByRole('navigation', { name: 'Path' })).toBe(breadcrumb);
      expect(screen.getByText('beta')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Use this folder' })).toBeDisabled();

      expect(await screen.findByText('src')).toBeInTheDocument();
      expect(screen.getByRole('navigation', { name: 'Path' })).toBe(breadcrumb);
    });
  });

  describe('when folders are searched', () => {
    it('shows only folders whose names match the query', async () => {
      server.use(
        http.get(FS_URL, ({ request }) => HttpResponse.json(listingFor(new URL(request.url).searchParams.get('path')))),
      );

      const user = userEvent.setup();
      renderWithProviders(<DirectoryBrowser onPick={vi.fn()} onCancel={vi.fn()} />);

      await screen.findByText('alpha');
      await user.type(screen.getByRole('textbox', { name: 'Search folders' }), 'ALP');

      await waitFor(() => expect(screen.queryByText('beta')).not.toBeInTheDocument());
      expect(screen.getByText('alpha')).toBeInTheDocument();
    });

    it('clears the query after browsing into a matching folder', async () => {
      server.use(
        http.get(FS_URL, ({ request }) => HttpResponse.json(listingFor(new URL(request.url).searchParams.get('path')))),
      );

      const user = userEvent.setup();
      renderWithProviders(<DirectoryBrowser onPick={vi.fn()} onCancel={vi.fn()} />);

      await screen.findByText('alpha');
      await user.type(screen.getByRole('textbox', { name: 'Search folders' }), 'alp');
      await user.click(screen.getByText('alpha'));

      expect(await screen.findByText('src')).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: 'Search folders' })).toHaveValue('');
    });
  });

  describe('when a folder is double-clicked', () => {
    it('does not pick the folder', async () => {
      server.use(
        http.get(FS_URL, ({ request }) => HttpResponse.json(listingFor(new URL(request.url).searchParams.get('path')))),
      );

      const onPick = vi.fn();
      renderWithProviders(<DirectoryBrowser onPick={onPick} onCancel={vi.fn()} />);

      fireEvent.doubleClick(await screen.findByText('alpha'));

      expect(onPick).not.toHaveBeenCalled();
    });
  });

  describe('when "Use this folder" is clicked', () => {
    it('picks the current listing path', async () => {
      server.use(
        http.get(FS_URL, ({ request }) => HttpResponse.json(listingFor(new URL(request.url).searchParams.get('path')))),
      );

      const onPick = vi.fn();
      const user = userEvent.setup();
      renderWithProviders(<DirectoryBrowser onPick={onPick} onCancel={vi.fn()} />);

      await screen.findByText('alpha');
      await user.click(screen.getByRole('button', { name: 'Use this folder' }));

      expect(onPick).toHaveBeenCalledWith('/projects', 'projects');
    });
  });
  describe('when listing fails', () => {
    it('shows an error', async () => {
      server.use(http.get(FS_URL, () => HttpResponse.json({ error: 'nope' }, { status: 500 })));

      renderWithProviders(<DirectoryBrowser onPick={vi.fn()} onCancel={vi.fn()} />);

      expect(await screen.findByText('nope')).toBeInTheDocument();
    });
  });
});
