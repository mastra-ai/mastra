import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { renderWithProviders } from '#test/render';

import { useOverlays } from '../../../../lib/overlays';
import type { Project } from '../../../workspaces';
import { CommandPalette, SLASH_COMMANDS, useChatCommands } from '../../index';
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
  const { composerCommandName } = useChatCommands();

  return (
    <>
      <button onClick={() => open('palette')}>Palette</button>
      <output aria-label="Selected composer command">{composerCommandName}</output>
      <ChatOverlays />
    </>
  );
}

function renderPalette() {
  localStorage.setItem('mastracode-projects', JSON.stringify([project]));
  localStorage.setItem('mastracode-active-project', project.id);
  return renderWithProviders(
    <OverlayTestProviders>
      <CommandPalette />
    </OverlayTestProviders>,
  );
}

function renderPaletteOverlay() {
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
  it('lists, focuses, and filters slash commands', async () => {
    const user = userEvent.setup();
    renderPalette();
    const input = screen.getByRole('combobox', { name: 'Filter commands' });
    await waitFor(() => expect(input).toHaveFocus());
    expect(within(screen.getByRole('listbox')).getAllByRole('option')).toHaveLength(SLASH_COMMANDS.length);
    await user.type(input, 'model');
    expect(screen.getByText('/model')).toBeInTheDocument();
  });

  it('matches command descriptions and shows an empty state', async () => {
    const user = userEvent.setup();
    renderPalette();
    const input = screen.getByRole('combobox', { name: 'Filter commands' });

    await user.type(input, 'Switch');
    expect(screen.getByRole('option', { name: /model/i })).toBeInTheDocument();

    await user.clear(input);
    await user.type(input, 'not-a-command');
    expect(screen.getByText('No matching commands')).toBeInTheDocument();
  });

  it('keeps an argument command selectable', async () => {
    const user = userEvent.setup();
    renderPalette();
    await user.click(screen.getByText('/model'));
    expect(screen.getByRole('option', { name: /model/i })).toHaveAttribute('aria-selected', 'true');
  });

  it('resets keyboard selection to the first filtered command before running it', async () => {
    const user = userEvent.setup();
    renderPaletteOverlay();
    await user.click(screen.getByRole('button', { name: 'Palette' }));
    const input = await screen.findByRole('combobox', { name: 'Filter commands' });

    await user.keyboard('{ArrowDown}{ArrowDown}');
    await user.type(input, 'model');

    expect(screen.getByRole('option', { name: /model/i })).toHaveAttribute('aria-selected', 'true');

    await user.keyboard('{Enter}');

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Command palette' })).not.toBeInTheDocument());
    expect(screen.getByLabelText('Selected composer command')).toHaveTextContent('model');
  });

  it('runs a clicked command and closes the palette', async () => {
    const user = userEvent.setup();
    renderPaletteOverlay();
    await user.click(screen.getByRole('button', { name: 'Palette' }));

    await user.click(await screen.findByRole('option', { name: /model/i }));

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Command palette' })).not.toBeInTheDocument());
    expect(screen.getByLabelText('Selected composer command')).toHaveTextContent('model');
  });

  it('wraps selection and closes with Escape without running a command', async () => {
    const user = userEvent.setup();
    renderPaletteOverlay();
    await user.click(screen.getByRole('button', { name: 'Palette' }));
    const input = await screen.findByRole('combobox', { name: 'Filter commands' });
    await waitFor(() => expect(input).toHaveFocus());

    await user.keyboard('{ArrowUp}');
    const commands = within(screen.getByRole('listbox')).getAllByRole('option');
    expect(commands.at(-1)).toHaveAttribute('aria-selected', 'true');

    await user.type(input, 'model');
    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Command palette' })).not.toBeInTheDocument());
    expect(screen.getByLabelText('Selected composer command')).toBeEmptyDOMElement();
  });
});
