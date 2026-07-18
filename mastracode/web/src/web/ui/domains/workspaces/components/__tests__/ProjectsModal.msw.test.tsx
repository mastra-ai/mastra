import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { server } from '../../../../../../../e2e/web-ui/msw-server';
import { TEST_BASE_URL, renderWithProviders } from '../../../../../../../e2e/web-ui/render';
import {
  OverlayTestProviders,
  useOverlayControllerHandlers,
} from '../../../chat/components/__tests__/overlay-test-utils';
import type { DirectoryListing } from '../../../../../../shared/api/types';
import { ProjectsModal } from '../../index';
import { loadProjects } from '../../services/projects';

const FS_URL = `${TEST_BASE_URL}/web/fs/list`;

const rootListing: DirectoryListing = {
  root: '/projects',
  path: '/projects',
  parent: null,
  entries: [{ name: 'gamma', path: '/projects/gamma' }],
};

function renderProjects() {
  return renderWithProviders(
    <OverlayTestProviders>
      <ProjectsModal />
    </OverlayTestProviders>,
  );
}

beforeEach(() => {
  localStorage.clear();
  useOverlayControllerHandlers();
  server.use(
    http.get(FS_URL, () => HttpResponse.json(rootListing)),
    http.get(`${TEST_BASE_URL}/web/project/resolve`, ({ request }) => {
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

describe('ProjectsModal', () => {
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
      expect(loadProjects()).toEqual([
        expect.objectContaining({ name: 'projects', path: '/projects', resourceId: expect.any(String) }),
      ]);
    });
    expect(localStorage.getItem('mastracode-active-project')).toBe(loadProjects()[0]?.id);
  });
});
