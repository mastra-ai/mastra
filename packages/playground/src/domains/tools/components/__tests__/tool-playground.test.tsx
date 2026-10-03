import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ZodType } from 'zod';
import { z } from 'zod';

import { ToolPlayground } from '../tool-playground';

function renderPlayground({
  zodInputSchema = z.object({}),
  execute = vi.fn<() => Promise<unknown>>().mockResolvedValue(undefined),
}: {
  zodInputSchema?: ZodType;
  execute?: () => Promise<unknown>;
} = {}) {
  return render(
    <ToolPlayground
      execute={execute}
      requestContextEntityType="tool"
      requestContextEntityId="test-tool"
      zodInputSchema={zodInputSchema}
    />,
  );
}

describe('ToolPlayground', () => {
  describe('when the tool takes no input', () => {
    it('says it can run as is', () => {
      renderPlayground();

      expect(screen.getByText('This tool takes no input. Run it as is.')).not.toBeNull();
    });

    it('still offers the request context popover', () => {
      renderPlayground();

      expect(screen.getByRole('button', { name: 'Request context' })).not.toBeNull();
    });
  });

  describe('when the tool has not run yet', () => {
    it('shows an empty response', () => {
      renderPlayground();

      expect(screen.getByText('No response yet')).not.toBeNull();
    });
  });

  describe('when the tool resolves', () => {
    it('shows the output as JSON with a success status', async () => {
      renderPlayground({ execute: vi.fn().mockResolvedValue({ dish: 'pasta' }) });

      fireEvent.click(screen.getByRole('button', { name: 'Run' }));

      expect(await screen.findByText('Success')).not.toBeNull();
      expect(screen.getByText(/"dish": "pasta"/)).not.toBeNull();
    });
  });

  describe('when the tool rejects', () => {
    it('shows the error message with an error status', async () => {
      renderPlayground({ execute: vi.fn().mockRejectedValue(new Error('Out of ingredients')) });

      fireEvent.click(screen.getByRole('button', { name: 'Run' }));

      expect(await screen.findByText('Error')).not.toBeNull();
      expect(screen.getByText(/Out of ingredients/)).not.toBeNull();
    });
  });

  describe('when Enter is pressed in a field', () => {
    it('runs the tool with the typed input', async () => {
      const execute = vi.fn().mockResolvedValue('ok');
      renderPlayground({ zodInputSchema: z.object({ ingredient: z.string() }), execute });

      const field = screen.getByRole('textbox');
      fireEvent.change(field, { target: { value: 'basil' } });
      fireEvent.keyDown(field, { key: 'Enter' });

      expect(await screen.findByText('Success')).not.toBeNull();
      expect(execute).toHaveBeenCalledWith({ ingredient: 'basil' }, expect.anything());
    });
  });

  describe('when Shift+Enter is pressed in a field', () => {
    it('does not run the tool', () => {
      const execute = vi.fn().mockResolvedValue('ok');
      renderPlayground({ zodInputSchema: z.object({ ingredient: z.string() }), execute });

      fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter', shiftKey: true });

      expect(execute).not.toHaveBeenCalled();
    });
  });
});
