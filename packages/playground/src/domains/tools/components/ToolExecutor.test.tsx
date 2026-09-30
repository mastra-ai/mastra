import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ZodType } from 'zod';
import { z } from 'zod';

import ToolExecutor from './ToolExecutor';

afterEach(() => cleanup());

function renderToolExecutor({
  zodInputSchema = z.object({}),
  handleExecuteTool = vi.fn<() => Promise<unknown>>().mockResolvedValue(undefined),
}: {
  zodInputSchema?: ZodType;
  handleExecuteTool?: () => Promise<unknown>;
} = {}) {
  return render(
    <ToolExecutor
      handleExecuteTool={handleExecuteTool}
      requestContextEntityType="tool"
      requestContextEntityId="test-tool"
      zodInputSchema={zodInputSchema}
    />,
  );
}

describe('ToolExecutor', () => {
  describe('when the tool has no input fields or request context', () => {
    it('still offers the request context popover', () => {
      renderToolExecutor();

      expect(screen.getByRole('button', { name: 'Request context' })).not.toBeNull();
    });

    it('explains that the tool can run without input', () => {
      renderToolExecutor();

      expect(screen.getByText('No input is required to run this tool.')).not.toBeNull();
    });

    it('keeps the tool executable', () => {
      renderToolExecutor();

      expect(screen.getByRole('button', { name: 'Run' })).not.toBeNull();
    });
  });

  describe('when the tool has not run yet', () => {
    it('shows an empty response', () => {
      renderToolExecutor();

      expect(screen.getByText('No response yet')).not.toBeNull();
    });
  });

  describe('when the tool resolves', () => {
    it('shows the output as JSON with a success status', async () => {
      renderToolExecutor({ handleExecuteTool: vi.fn().mockResolvedValue({ dish: 'pasta' }) });

      fireEvent.click(screen.getByRole('button', { name: 'Run' }));

      expect(await screen.findByText('Success')).not.toBeNull();
      expect(screen.getByText(/"dish": "pasta"/)).not.toBeNull();
    });
  });

  describe('when the tool rejects', () => {
    it('shows the error message with an error status', async () => {
      renderToolExecutor({ handleExecuteTool: vi.fn().mockRejectedValue(new Error('Out of ingredients')) });

      fireEvent.click(screen.getByRole('button', { name: 'Run' }));

      expect(await screen.findByText('Error')).not.toBeNull();
      expect(screen.getByText(/Out of ingredients/)).not.toBeNull();
    });
  });
});
