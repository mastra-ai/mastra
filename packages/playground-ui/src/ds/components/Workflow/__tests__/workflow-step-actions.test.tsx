// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WorkflowStepAction } from '../controls/workflow-step-action';
import { WorkflowStepActions } from '../controls/workflow-step-actions';

afterEach(cleanup);

describe('WorkflowStepActions', () => {
  describe('when a step exposes an action', () => {
    it('opens its menu and delegates the selected action', async () => {
      const onSelect = vi.fn();
      render(
        <WorkflowStepActions>
          <WorkflowStepAction action="runStep" onSelect={onSelect} />
        </WorkflowStepActions>,
      );

      fireEvent.click(screen.getByRole('button', { name: 'Step actions' }));
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Run step' }));

      expect(onSelect).toHaveBeenCalledOnce();
      await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    });
  });
});
