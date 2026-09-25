// @vitest-environment jsdom
import '@/test/jsdom-polyfills';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { WorkflowTriggerForm } from '../workflow-trigger-form';

afterEach(() => cleanup());

const schema = z.object({ request: z.boolean() });

describe('WorkflowTriggerForm', () => {
  describe('when viewing a run with an input schema', () => {
    it('keeps the run header without exposing another editable form', () => {
      render(
        <WorkflowTriggerForm
          zodSchema={schema}
          isStreaming={false}
          onExecute={vi.fn()}
          defaultValues={{ request: true }}
          isViewingRun
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

  describe('when preparing a new run without an input schema', () => {
    it('keeps the workflow header above the Run button', () => {
      render(
        <WorkflowTriggerForm
          zodSchema={null}
          isStreaming={false}
          onExecute={vi.fn()}
          headingSlot={<div>Workflow header</div>}
        />,
      );
      expect(screen.getByText('Workflow header')).not.toBeNull();
      expect(screen.getByRole('button', { name: /^run$/i })).not.toBeNull();
    });
  });

  describe('when a run has no input schema', () => {
    it('keeps the run status visible without an empty input control', () => {
      render(
        <WorkflowTriggerForm
          zodSchema={null}
          isStreaming={false}
          onExecute={vi.fn()}
          isViewingRun
          headingSlot={<div>Paused run</div>}
        />,
      );
      expect(screen.getByText('Paused run')).not.toBeNull();
    });
  });
});
