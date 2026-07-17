import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { renderWithProviders } from '../../../../../../../e2e/web-ui/render';
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
    expect(await screen.findByRole('dialog', { name: 'Projects' })).toBeInTheDocument();
  });

  it('forces first-run project setup when no project is active', () => {
    renderOverlays();
    expect(screen.getByRole('dialog', { name: 'Open a project' })).toBeInTheDocument();
  });
});
