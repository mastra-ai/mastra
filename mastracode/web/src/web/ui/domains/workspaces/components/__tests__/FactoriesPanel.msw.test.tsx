import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { server } from '../../../../../../../e2e/web-ui/msw-server';
import { TEST_BASE_URL, renderWithProviders } from '../../../../../../../e2e/web-ui/render';
import type { DirectoryListing } from '../../../../../../shared/api/types';
import { ActiveFactoryProvider } from '../../context/ActiveFactoryProvider';
import { FactoriesPanel } from '../../index';
import { loadFactories } from '../../services/factories';

const FS_URL = `${TEST_BASE_URL}/web/fs/list`;

const rootListing: DirectoryListing = {
  root: '/projects',
  path: '/projects',
  parent: null,
  entries: [{ name: 'gamma', path: '/projects/gamma' }],
};

function LocationProbe() {
  return <output data-testid="pathname">{useLocation().pathname}</output>;
}

function renderFactories() {
  const onClose = vi.fn();
  const view = renderWithProviders(
    <MemoryRouter initialEntries={['/factories/create']}>
      <ActiveFactoryProvider factoryId="missing-factory">
        <FactoriesPanel onClose={onClose} />
        <LocationProbe />
      </ActiveFactoryProvider>
    </MemoryRouter>,
  );
  return { onClose, ...view };
}

beforeEach(() => {
  localStorage.clear();
  server.use(
    http.get(FS_URL, () => HttpResponse.json(rootListing)),
    http.get(`${TEST_BASE_URL}/web/codebase/resolve`, ({ request }) => {
      expect(new URL(request.url).searchParams.get('path')).toBe('/projects');
      return HttpResponse.json({
        resourceId: 'resource-projects',
        name: 'projects',
        rootPath: '/projects',
      });
    }),
  );
});

afterEach(() => localStorage.clear());

describe('FactoriesPanel', () => {
  it('renders as a labelled in-layout section without dialog semantics', async () => {
    renderFactories();

    expect(await screen.findByRole('region', { name: 'Create Factory' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Factory name')).toHaveFocus();
  });

  it('creates a named server-backed Factory as the primary path, then lands on the Board', async () => {
    let received: unknown;
    server.use(
      http.post(`${TEST_BASE_URL}/web/factory/projects`, async ({ request }) => {
        received = await request.json();
        return HttpResponse.json({ project: { id: 'fp-1', name: 'Mastra' } });
      }),
    );
    const user = userEvent.setup();
    renderFactories();

    await user.type(await screen.findByLabelText('Factory name'), 'Mastra');
    await user.click(screen.getByRole('button', { name: 'Create Factory' }));

    await waitFor(() => {
      expect(loadFactories()).toEqual([
        expect.objectContaining({
          name: 'Mastra',
          binding: expect.objectContaining({ kind: 'factory', factoryProjectId: 'fp-1', repositories: [] }),
        }),
      ]);
    });
    expect(received).toEqual({ name: 'Mastra' });
    await waitFor(() =>
      expect(screen.getByTestId('pathname')).toHaveTextContent(`/factories/${loadFactories()[0]?.id}/work`),
    );
  });

  it('binds a local folder through the secondary path, then lands on /new', async () => {
    const user = userEvent.setup();
    renderFactories();

    await user.click(await screen.findByRole('button', { name: 'Bind a local folder instead' }));

    // The directory browser lists the folders at the fs root.
    expect(await screen.findByText('gamma')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Use this folder' }));

    await waitFor(() => {
      expect(loadFactories()).toEqual([
        expect.objectContaining({
          name: 'projects',
          resourceId: expect.any(String),
          binding: expect.objectContaining({ kind: 'local', path: '/projects' }),
        }),
      ]);
    });
    await waitFor(() =>
      expect(screen.getByTestId('pathname')).toHaveTextContent(`/factories/${loadFactories()[0]?.id}/new`),
    );
  });

  it('calls onClose from the Cancel button and from Escape', async () => {
    const user = userEvent.setup();
    const { onClose } = renderFactories();

    await user.click(await screen.findByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);

    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
