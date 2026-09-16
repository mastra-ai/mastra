import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ZodType } from 'zod';
import { z } from 'zod';

import ToolExecutor from './ToolExecutor';

afterEach(() => cleanup());
beforeEach(() => localStorage.clear());

function renderToolExecutor(zodInputSchema: ZodType = z.object({}), handleExecuteTool = vi.fn()) {
  return render(
    <TooltipProvider>
      <ToolExecutor
        executionResult={undefined}
        handleExecuteTool={handleExecuteTool}
        isExecutingTool={false}
        toolDescription="Runs without configuration"
        toolId="test-tool"
        entityKey="tool:test-tool"
        zodInputSchema={zodInputSchema}
      />
    </TooltipProvider>,
  );
}

describe('ToolExecutor', () => {
  describe('when the tool has no input fields or request context schema', () => {
    it('still renders the run options trigger', () => {
      renderToolExecutor();

      expect(screen.getByTestId('tool-run-options-trigger')).not.toBeNull();
    });

    it('opens the request context editor from run options', async () => {
      renderToolExecutor();

      fireEvent.click(screen.getByTestId('tool-run-options-trigger'));

      expect(await screen.findByText('Request Context (JSON)', undefined, { timeout: 10_000 })).not.toBeNull();
    }, 15_000);

    it('explains that the tool can run without input', () => {
      renderToolExecutor();

      expect(screen.getByText('No input is required to run this tool.')).not.toBeNull();
    });

    it('keeps the tool executable', () => {
      renderToolExecutor();

      expect(screen.getByRole('button', { name: 'Submit' })).not.toBeNull();
    });
  });

  describe('when a request context was persisted for the tool', () => {
    it('passes it to the execute handler', async () => {
      localStorage.setItem('mastra:request-context:tool:test-tool', JSON.stringify({ userId: 'u1' }));
      const handleExecuteTool = vi.fn();
      renderToolExecutor(z.object({}), handleExecuteTool);

      fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

      await waitFor(() => expect(handleExecuteTool).toHaveBeenCalledWith({}, { userId: 'u1' }));
    });
  });

  describe('when the tool has input fields', () => {
    it('renders the input form', () => {
      renderToolExecutor(z.object({ query: z.string() }));

      expect(screen.getByLabelText(/query/i)).not.toBeNull();
      expect(screen.queryByText('No input is required to run this tool.')).toBeNull();
    });
  });
});
