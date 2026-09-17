// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { WorkflowTriggerForm } from '../workflow-trigger-form';

afterEach(() => cleanup());

const schema = z.object({ request: z.boolean() });

describe('WorkflowTriggerForm', () => {
  describe('when viewing a run with an input schema', () => {
    it('opens the stored input for read-only inspection without execution actions', async () => {
      const onExecute = vi.fn();
      render(
        <WorkflowTriggerForm
          zodSchema={schema}
          isStreaming={false}
          onExecute={onExecute}
          defaultValues={{ request: true }}
          isViewingRun
          isReadOnly
          collapsible={false}
          headingSlot={<div data-testid="heading-slot">heading</div>}
          leftActions={<div data-testid="left-actions">debug</div>}
          submitActions={<div data-testid="submit-actions">options</div>}
        />,
      );

      expect(screen.getByTestId('heading-slot')).not.toBeNull();
      expect(screen.queryByRole('button', { name: /^run$/i })).toBeNull();
      expect(screen.queryByTestId('left-actions')).toBeNull();
      expect(screen.queryByTestId('submit-actions')).toBeNull();

      fireEvent.click(screen.getByRole('button', { name: /run input/i }));
      const request = await screen.findByRole('checkbox', { name: /request/i });
      expect(request.getAttribute('aria-checked')).toBe('true');
      fireEvent.click(request);
      expect(request.getAttribute('aria-checked')).toBe('true');
      expect(screen.queryByRole('button', { name: /^run$/i })).toBeNull();
      expect(onExecute).not.toHaveBeenCalled();
    });
  });

  describe('when preparing a new run', () => {
    it('executes the workflow with the edited input', async () => {
      const onExecute = vi.fn();
      render(
        <WorkflowTriggerForm
          zodSchema={schema}
          isStreaming={false}
          onExecute={onExecute}
          defaultValues={{ request: true }}
          collapsible={false}
        />,
      );

      fireEvent.click(screen.getByRole('checkbox', { name: /request/i }));
      fireEvent.click(screen.getByRole('button', { name: /^run$/i }));
      await waitFor(() => expect(onExecute).toHaveBeenCalledWith({ request: false }));
    });
  });
});
