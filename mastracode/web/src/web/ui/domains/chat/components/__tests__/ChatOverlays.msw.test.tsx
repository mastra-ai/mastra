import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { server } from '../../../../../../../e2e/web-ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../../../../e2e/web-ui/render';
import { useOverlays } from '../../../../lib/overlays';
import type { Project } from '../../../workspaces';
import { ChatOverlays } from '../ChatOverlays';
import { OverlayTestProviders, useOverlayControllerHandlers } from './overlay-test-utils';

const project: Project = {
  id: 'project-test',
  name: 'Test',
  path: '/tmp/test',
  resourceId: 'resource-test',
  createdAt: 1,
};

function OverlayLauncher() {
  const { open } = useOverlays();
  return (
    <>
      <button onClick={() => open('settings')}>Settings</button>
      <button onClick={() => open('shortcuts')}>Shortcuts</button>
      <button onClick={() => open('projects')}>Projects</button>
      <ChatOverlays />
    </>
  );
}

function renderOverlays() {
  return renderWithProviders(
    <OverlayTestProviders>
      <OverlayLauncher />
    </OverlayTestProviders>,
  );
}

beforeEach(useOverlayControllerHandlers);
afterEach(() => localStorage.clear());

describe('ChatOverlays', () => {
  it('given a project, when contextual overlays are opened, then it mounts settings, shortcuts, and projects', async () => {
    localStorage.setItem('mastracode-projects', JSON.stringify([project]));
    localStorage.setItem('mastracode-active-project', project.id);
    const user = userEvent.setup();
    renderOverlays();

    await user.click(screen.getByRole('button', { name: 'Settings' }));
    expect(await screen.findByRole('dialog', { name: 'Settings' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Close' }));
    await user.click(screen.getByRole('button', { name: 'Shortcuts' }));
    expect(await screen.findByRole('dialog', { name: 'Keyboard shortcuts' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Close' }));
    await user.click(screen.getByRole('button', { name: 'Projects' }));
    expect(await screen.findByRole('dialog', { name: 'Open a project' })).toBeInTheDocument();
  });

  it('waits for backend projects before deciding whether first-run setup is needed', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/web/github/status`, () =>
        HttpResponse.json({ enabled: true, connected: true, installations: [], reason: 'ready' }),
      ),
      http.get(`${TEST_BASE_URL}/web/github/projects`, () =>
        HttpResponse.json([
          {
            id: 'github-project',
            name: 'mastra',
            source: 'github',
            githubProjectId: 'github-project',
            resourceId: 'github-project',
            worktrees: [],
            createdAt: 1,
          },
        ]),
      ),
    );

    renderOverlays();

    expect(screen.queryByRole('dialog', { name: 'Open a project' })).not.toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Open a project' })).not.toBeInTheDocument());
  });

  it('offers GitHub when first-run setup has no projects', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/web/github/status`, () =>
        HttpResponse.json({ enabled: true, connected: false, installations: [], reason: 'not_connected' }),
      ),
      http.get(`${TEST_BASE_URL}/web/github/projects`, () => HttpResponse.json([])),
    );
    const user = userEvent.setup();

    renderOverlays();

    expect(await screen.findByRole('dialog', { name: 'Open a project' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Open from GitHub' }));
    expect(await screen.findByRole('dialog', { name: 'Connect GitHub' })).toBeInTheDocument();
  });
});
