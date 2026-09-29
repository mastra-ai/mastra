import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '../../../../../../e2e/ui/render';
import { ToolCard } from '../tool/ToolCard';
import { commandTool, editTool, longResultTool } from './fixtures/tool-bodies';

describe('Factory tool body', () => {
  describe('when a command streams shell output', () => {
    it('keeps shell output visible and excludes the partial structured result', async () => {
      renderWithProviders(<ToolCard tool={commandTool} />);
      await userEvent.click(screen.getByRole('button', { name: /Run/ }));

      expect(screen.getByText('Live shell output')).toBeVisible();
      expect(screen.queryByText('Partial structured output')).not.toBeInTheDocument();
      expect(screen.getByRole('group', { name: 'Tool: execute_command' })).toHaveAttribute('aria-busy', 'true');
    });
  });

  describe('when an edit succeeds', () => {
    it('shows the change without the redundant success result', async () => {
      renderWithProviders(<ToolCard tool={editTool} />);
      await userEvent.click(screen.getByRole('button', { name: /Edit/ }));

      expect(screen.getByRole('group', { name: 'File change' })).toBeVisible();
      expect(screen.queryByText('File updated')).not.toBeInTheDocument();
    });
  });

  describe('when an edit fails', () => {
    it('shows the error beside the proposed change', async () => {
      renderWithProviders(<ToolCard tool={{ ...editTool, status: 'error', result: 'Permission denied' }} />);
      await userEvent.click(screen.getByRole('button', { name: /Edit/ }));

      expect(screen.getByRole('group', { name: 'File change' })).toBeVisible();
      expect(screen.getByText('Permission denied')).toBeVisible();
    });
  });

  describe('when a result exceeds the preview limit', () => {
    it('copies the whole result', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ToolCard tool={longResultTool} />);
      await user.click(screen.getByRole('button', { name: /Read/ }));
      await user.click(screen.getByRole('button', { name: 'Copy to clipboard' }));

      expect(await navigator.clipboard.readText()).toBe(longResultTool.result);
    });
  });
});
