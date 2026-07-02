import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../../e2e/web-ui/render';
import { CommandPalette } from './CommandPalette';
import { SLASH_COMMANDS } from './commands';

describe('CommandPalette', () => {
  describe('when it opens', () => {
    it('lists every slash command', () => {
      renderWithProviders(<CommandPalette onRun={vi.fn()} onClose={vi.fn()} />);

      const list = screen.getByRole('listbox', { name: 'Commands' });
      expect(within(list).getAllByRole('option')).toHaveLength(SLASH_COMMANDS.length);
    });

    it('focuses the filter input', async () => {
      renderWithProviders(<CommandPalette onRun={vi.fn()} onClose={vi.fn()} />);

      // The dialog applies initial focus asynchronously after its open animation.
      await waitFor(() => expect(screen.getByRole('textbox', { name: 'Filter commands' })).toHaveFocus());
    });
  });

  describe('when the user types a query', () => {
    it('filters to matching commands', async () => {
      const user = userEvent.setup();
      renderWithProviders(<CommandPalette onRun={vi.fn()} onClose={vi.fn()} />);

      await user.type(screen.getByRole('textbox', { name: 'Filter commands' }), 'model');

      const options = screen.getAllByRole('option');
      expect(options.length).toBeGreaterThan(0);
      expect(options.length).toBeLessThan(SLASH_COMMANDS.length);
      expect(screen.getByText('/model')).toBeInTheDocument();
    });

    it('shows an empty state when nothing matches', async () => {
      const user = userEvent.setup();
      renderWithProviders(<CommandPalette onRun={vi.fn()} onClose={vi.fn()} />);

      await user.type(screen.getByRole('textbox', { name: 'Filter commands' }), 'zzzznope');

      expect(screen.getByText('No matching commands')).toBeInTheDocument();
      expect(screen.queryAllByRole('option')).toHaveLength(0);
    });
  });

  describe('when a command is clicked', () => {
    it('runs it and closes', async () => {
      const onRun = vi.fn();
      const onClose = vi.fn();
      const user = userEvent.setup();
      renderWithProviders(<CommandPalette onRun={onRun} onClose={onClose} />);

      await user.click(screen.getByText('/model'));

      expect(onRun).toHaveBeenCalledWith(expect.objectContaining({ name: 'model' }));
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('when the user presses Enter', () => {
    it('runs the active command', async () => {
      const onRun = vi.fn();
      const user = userEvent.setup();
      renderWithProviders(<CommandPalette onRun={onRun} onClose={vi.fn()} />);

      const input = screen.getByRole('textbox', { name: 'Filter commands' });
      await user.type(input, '{ArrowDown}{Enter}');

      expect(onRun).toHaveBeenCalledWith(expect.objectContaining({ name: SLASH_COMMANDS[1].name }));
    });
  });
});
