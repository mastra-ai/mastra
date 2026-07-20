import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { server } from '../../../../../../../e2e/web-ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../../../../e2e/web-ui/render';
import { useOverlays } from '../../../../lib/overlays';
import type { Factory } from '../../../workspaces';
import { ChatOverlays } from '../ChatOverlays';
import { OverlayTestProviders, useOverlayControllerHandlers } from './overlay-test-utils';

const project: Factory = {
  id: 'project-test',
  name: 'Test',
  resourceId: 'resource-test',
  createdAt: 1,
  binding: {
    kind: 'local',
    path: '/tmp/test',
  },
};

function OverlayLauncher() {
  const { open } = useOverlays();
  return (
    <>
      <button onClick={() => open('settings')}>Settings</button>
      <button onClick={() => open('shortcuts')}>Shortcuts</button>
      <button onClick={() => open('factories')}>Factories</button>
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

function stubGithubStatus(body: Record<string, unknown>, options?: { neverResolve?: boolean }) {
  server.use(
    http.get(`${TEST_BASE_URL}/web/github/status`, async () => {
      if (options?.neverResolve) {
        await delay('infinite');
      }
      return HttpResponse.json(body);
    }),
  );
}

beforeEach(useOverlayControllerHandlers);
afterEach(() => localStorage.clear());

describe('ChatOverlays', () => {
  it('given a project, when contextual overlays are opened, then it mounts settings, shortcuts, and projects', async () => {
    stubGithubStatus({ enabled: false, connected: false, installations: [] });
    localStorage.setItem('mastracode-factories', JSON.stringify([project]));
    localStorage.setItem('mastracode-active-factory', project.id);
    const user = userEvent.setup();
    renderOverlays();

    await user.click(screen.getByRole('button', { name: 'Settings' }));
    expect(await screen.findByRole('dialog', { name: 'Settings' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Close' }));
    await user.click(screen.getByRole('button', { name: 'Shortcuts' }));
    expect(await screen.findByRole('dialog', { name: 'Keyboard shortcuts' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Close' }));
    await user.click(screen.getByRole('button', { name: 'Factories' }));
    expect(await screen.findByRole('dialog', { name: 'Create factory' })).toBeInTheDocument();
  });

  it('first-run with GitHub available opens Connect GitHub, not the local factory dialog', async () => {
    stubGithubStatus({ enabled: true, connected: false, installations: [] });
    renderOverlays();

    expect(await screen.findByRole('dialog', { name: 'Connect GitHub' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Create factory' })).not.toBeInTheDocument();
  });

  it('first-run with authRequired opens Connect GitHub', async () => {
    stubGithubStatus({ enabled: false, connected: false, installations: [], authRequired: true });
    renderOverlays();

    expect(await screen.findByRole('dialog', { name: 'Connect GitHub' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Create factory' })).not.toBeInTheDocument();
  });

  it('first-run with GitHub disabled opens the local factory dialog after hydration', async () => {
    stubGithubStatus({ enabled: false, connected: false, installations: [] });
    renderOverlays();

    expect(await screen.findByRole('dialog', { name: 'Create factory' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Connect GitHub' })).not.toBeInTheDocument();
  });

  it('first-run while GitHub status is pending mounts neither forced dialog', async () => {
    stubGithubStatus({ enabled: true, connected: false, installations: [] }, { neverResolve: true });
    renderOverlays();

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Connect GitHub' })).not.toBeInTheDocument();
      expect(screen.queryByRole('dialog', { name: 'Create factory' })).not.toBeInTheDocument();
    });
  });

  it('hydrates a source-control repository before deciding whether to show first-run setup', async () => {
    stubGithubStatus({ enabled: true, connected: false, installations: [] });
    server.use(
      http.get(`${TEST_BASE_URL}/web/github/repositories`, () =>
        HttpResponse.json([
          {
            id: 'github-project-1',
            name: 'mastra',
            source: 'github',
            githubProjectId: 'github-project-1',
            resourceId: 'github-project-1',
            gitBranch: 'main',
            sandboxWorkdir: '/workspace/acme/mastra',
            worktrees: [],
            createdAt: 1,
          },
        ]),
      ),
    );

    renderOverlays();

    await waitFor(() => expect(localStorage.getItem('mastracode-factories')).toContain('github-project-1'));
    expect(screen.queryByRole('dialog', { name: 'Create factory' })).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Connect GitHub' })).not.toBeInTheDocument();
  });

  it('escape hatch from first-run GitHub opens the local factory dialog', async () => {
    stubGithubStatus({ enabled: true, connected: false, installations: [] });
    renderOverlays();

    expect(await screen.findByRole('dialog', { name: 'Connect GitHub' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Use a local folder instead' }));

    expect(await screen.findByRole('dialog', { name: 'Create factory' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Connect GitHub' })).not.toBeInTheDocument();
  });
});
