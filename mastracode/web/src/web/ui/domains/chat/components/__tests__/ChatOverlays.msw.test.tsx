import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
  it('given a project, when contextual overlays are opened, then it mounts settings and shortcuts', async () => {
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
  });
});
