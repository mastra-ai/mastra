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

      const source = await screen.findByRole('textbox');
      expect(Array.from(source.querySelectorAll('.cm-line'), line => line.textContent).join('\n')).toBe(instructions);
      expect(source.getAttribute('contenteditable')).toBe('false');
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
