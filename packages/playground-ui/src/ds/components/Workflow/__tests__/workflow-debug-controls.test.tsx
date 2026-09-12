// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WorkflowDebugControls } from '../controls/workflow-debug-controls';

afterEach(cleanup);

describe('WorkflowDebugControls', () => {
  describe('when a paused run can advance', () => {
    it('delegates stepping and continuing to the caller', () => {
      const onRunNextStep = vi.fn();
      const onContinueRun = vi.fn();
      render(<WorkflowDebugControls canRunNextStep onRunNextStep={onRunNextStep} onContinueRun={onContinueRun} />);

      fireEvent.click(screen.getByRole('button', { name: 'Run next step' }));
      fireEvent.click(screen.getByRole('button', { name: 'Continue full run' }));

      expect(onRunNextStep).toHaveBeenCalledOnce();
      expect(onContinueRun).toHaveBeenCalledOnce();
    });
  });

  describe('when a step is streaming', () => {
    it('prevents another step or continue action', () => {
      const onRunNextStep = vi.fn();
      const onContinueRun = vi.fn();
      render(
        <WorkflowDebugControls
          canRunNextStep
          isStreaming
          onRunNextStep={onRunNextStep}
          onContinueRun={onContinueRun}
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: 'Run next step' }));
      fireEvent.click(screen.getByRole('button', { name: 'Continue full run' }));

      expect(onRunNextStep).not.toHaveBeenCalled();
      expect(onContinueRun).not.toHaveBeenCalled();
    });
  });
});
