import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { renderWithProviders } from '../../../../../../../e2e/web-ui/render';
import { useOverlays } from '../../../../lib/overlays';
import type { Project } from '../../../workspaces';
import { SLASH_COMMANDS } from '../../services/commands';
import { ChatOverlays } from '../ChatOverlays';
import { OverlayTestProviders, useOverlayControllerHandlers } from './overlay-test-utils';

const project: Project = {
  id: 'project-test',
  name: 'Test',
  path: '/tmp/test',
  resourceId: 'resource-test',
  createdAt: 1,
};

function PaletteLauncher() {
  const { open } = useOverlays();

  return (
    <>
      <button onClick={() => open('palette')}>Palette</button>
      <ChatOverlays />
    </>
  );
}

function renderPalette() {
  localStorage.setItem('mastracode-projects', JSON.stringify([project]));
  localStorage.setItem('mastracode-active-project', project.id);
  return renderWithProviders(
    <OverlayTestProviders>
      <PaletteLauncher />
    </OverlayTestProviders>,
  );
}

beforeEach(useOverlayControllerHandlers);
afterEach(() => localStorage.clear());

describe('CommandPalette', () => {
  it('opens from the overlay entrypoint and lists, focuses, and filters slash commands', async () => {
    const user = userEvent.setup();
    renderPalette();
    await user.click(screen.getByRole('button', { name: 'Palette' }));
    const input = await screen.findByRole('combobox', { name: 'Filter commands' });

    await waitFor(() => expect(input).toHaveFocus());
    expect(within(screen.getByRole('listbox')).getAllByRole('option')).toHaveLength(SLASH_COMMANDS.length);
    await user.type(input, 'model');
    expect(screen.getByText('/model')).toBeInTheDocument();
  });

  it('matches command descriptions and shows an empty state', async () => {
    const user = userEvent.setup();
    renderPalette();
    await user.click(screen.getByRole('button', { name: 'Palette' }));
    const input = await screen.findByRole('combobox', { name: 'Filter commands' });

    await user.type(input, 'Switch');
    expect(screen.getByRole('option', { name: /model/i })).toBeInTheDocument();
    await user.clear(input);
    await user.type(input, 'not-a-command');
    expect(screen.getByText('No matching commands')).toBeInTheDocument();
  });

  it('runs a selected command and closes the palette', async () => {
    const user = userEvent.setup();
    renderPalette();
    await user.click(screen.getByRole('button', { name: 'Palette' }));

    await user.click(await screen.findByRole('option', { name: /help/i }));

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Command palette' })).not.toBeInTheDocument());
  });

  it('closes with Escape without running a command', async () => {
    const user = userEvent.setup();
    renderPalette();
    await user.click(screen.getByRole('button', { name: 'Palette' }));
    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Command palette' })).not.toBeInTheDocument());
  });
});
