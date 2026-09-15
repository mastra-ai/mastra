import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AgentSystemPrompt } from '../agent-system-prompt';

const instructions = 'Follow **these instructions**.\n\n- Keep `source_text` unchanged.\n- Ask before publishing.';

describe('AgentSystemPrompt', () => {
  describe('when the prompt contains markdown', () => {
    it('shows the exact prompt in the source view', async () => {
      render(
        <TooltipProvider>
          <AgentSystemPrompt instructions={instructions} />
        </TooltipProvider>,
      );

      fireEvent.click(screen.getByRole('tab', { name: 'Source' }));

      const source = await screen.findByRole('region', { name: 'System prompt source' });
      expect(source.textContent).toBe(instructions);
      expect(screen.queryByRole('textbox')).toBeNull();
    });

    it('keeps whitespace intact when switching wrapping and reading modes', () => {
      const indentedInstructions = 'Keep this exact.\n\n      - Six spaces\n\t- A tab\n';
      render(
        <TooltipProvider>
          <AgentSystemPrompt instructions={indentedInstructions} />
        </TooltipProvider>,
      );

      expect(screen.queryByRole('button', { name: 'Wrap lines' })).toBeNull();
      fireEvent.click(screen.getByRole('tab', { name: 'Source' }));
      fireEvent.click(screen.getByRole('button', { name: 'Wrap lines', pressed: true }));
      expect(screen.getByRole('region', { name: 'System prompt source' }).textContent).toBe(indentedInstructions);

      fireEvent.click(screen.getByRole('tab', { name: 'Read' }));
      fireEvent.click(screen.getByRole('tab', { name: 'Source' }));
      fireEvent.click(screen.getByRole('button', { name: 'Wrap lines', pressed: false }));
      expect(screen.getByRole('region', { name: 'System prompt source' }).textContent).toBe(indentedInstructions);
    });

    it('renders formatted instructions in the reading view', () => {
      render(
        <TooltipProvider>
          <AgentSystemPrompt instructions={instructions} />
        </TooltipProvider>,
      );

      expect(screen.getByText('these instructions').tagName).toBe('STRONG');
      expect(screen.getAllByRole('listitem')).toHaveLength(2);
    });
  });

  describe('when no system prompt is configured', () => {
    it('shows an empty state', () => {
      render(
        <TooltipProvider>
          <AgentSystemPrompt instructions="" />
        </TooltipProvider>,
      );

      expect(screen.getByText('No system prompt configured')).toBeTruthy();
    });
  });
});
