import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { server } from '../../../../../../../e2e/web-ui/msw-server';
import { TEST_BASE_URL, renderWithProviders } from '../../../../../../../e2e/web-ui/render';
import {
  OverlayTestProviders,
  useOverlayControllerHandlers,
} from '../../../chat/components/__tests__/overlay-test-utils';
import type { DirectoryListing } from '../../../../../../shared/api/types';
import { FactoriesPanel } from '../../index';
import { loadFactories } from '../../services/factories';

const FS_URL = `${TEST_BASE_URL}/web/fs/list`;

const rootListing: DirectoryListing = {
  root: '/projects',
  path: '/projects',
  parent: null,
  entries: [{ name: 'gamma', path: '/projects/gamma' }],
};

function renderProjects(onOpenGithub?: () => void) {
  return renderWithProviders(
    <OverlayTestProviders>
      <FactoriesPanel onOpenGithub={onOpenGithub} />
    </OverlayTestProviders>,
  );
}

beforeEach(() => {
  localStorage.clear();
  useOverlayControllerHandlers();
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
  it('offers GitHub alongside local directory browsing', async () => {
    const onOpenGithub = vi.fn();
    const user = userEvent.setup();
    renderProjects(onOpenGithub);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Create/connect factory from GitHub' }));

    expect(onOpenGithub).toHaveBeenCalledOnce();
  });

  it('opens directly into local directory browsing', async () => {
    renderProjects();

    expect(await screen.findByText('gamma')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Use this folder' })).toBeInTheDocument();
  });

  it('adds and selects the currently displayed folder', async () => {
    const user = userEvent.setup();
    renderProjects();

    await user.click(await screen.findByRole('button', { name: 'Use this folder' }));

    await waitFor(() => {
      expect(loadFactories()).toEqual([
        expect.objectContaining({
          name: 'projects',
          resourceId: expect.any(String),
          binding: expect.objectContaining({ kind: 'local', path: '/projects' }),
        }),
      ]);
    });
    expect(localStorage.getItem('mastracode-active-factory')).toBe(loadFactories()[0]?.id);
  });
});
