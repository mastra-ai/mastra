import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ZodType } from 'zod';
import { z } from 'zod';

import ToolExecutor from './ToolExecutor';

afterEach(() => cleanup());

function renderToolExecutor(zodInputSchema: ZodType = z.object({})) {
  return render(
    <ToolExecutor
      executionResult={undefined}
      handleExecuteTool={vi.fn()}
      isExecutingTool={false}
      toolDescription="Runs without configuration"
      toolId="test-tool"
      zodInputSchema={zodInputSchema}
    />,
  );
}

describe('ToolExecutor', () => {
  describe('when the tool has no input fields or request context', () => {
    it('does not render configuration tabs', () => {
      renderToolExecutor();

      expect(screen.queryByRole('tab')).toBeNull();
    });

    it('explains that the tool can run without input', () => {
      renderToolExecutor();

      expect(screen.getByText('No input is required to run this tool.')).not.toBeNull();
    });

    it('keeps the tool executable', () => {
      renderToolExecutor();

      expect(screen.getByRole('button', { name: 'Submit' })).not.toBeNull();
    });
  });

  describe('when the tool has input fields', () => {
    it('renders the Input Data tab', () => {
      renderToolExecutor(z.object({ query: z.string() }));

      expect(screen.getByRole('tab', { name: 'Input Data' })).not.toBeNull();
    });
  });
});
