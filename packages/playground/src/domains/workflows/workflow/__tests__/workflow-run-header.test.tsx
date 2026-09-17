import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WorkflowRunStreamResult } from '../../context/workflow-run-context';
import { RunWorkflowHeader } from '../workflow-run-header';

const completed: WorkflowRunStreamResult = {
  status: 'success',
  input: {},
  result: {},
  steps: { instant: { status: 'success', payload: {}, output: {}, startedAt: 0, endedAt: 0 } },
};

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('Workflow run header', () => {
  describe('when a completed run has zero-duration timestamps', () => {
    it('shows the recorded zero rather than treating the end timestamp as absent', () => {
      render(<RunWorkflowHeader runId="completed" status="success" result={completed} />);
      expect(screen.getByTitle('Run duration').textContent).toBe('0ms');
    });
  });

  describe('when an invalid step timestamp accompanies measured steps', () => {
    it('keeps the measured duration instead of rendering NaN', () => {
      render(
        <RunWorkflowHeader
          runId="completed"
          status="success"
          result={{
            ...completed,
            steps: {
              ...completed.steps,
              invalid: { status: 'success', payload: {}, output: {}, startedAt: NaN, endedAt: NaN },
            },
          }}
        />,
      );
      expect(screen.getByTitle('Run duration').textContent).toBe('0ms');
    });
  });

  describe('when a paused run resumes after time has passed', () => {
    it('counts from the run start once running and stops at the recorded end', () => {
      vi.useFakeTimers();
      vi.setSystemTime(1_000);
      const active: WorkflowRunStreamResult = {
        status: 'running',
        input: {},
        steps: { work: { status: 'running', payload: {}, startedAt: 0 } },
      };
      const view = render(<RunWorkflowHeader runId="run" status="paused" result={active} />);
      expect(screen.queryByTitle('Run duration')).toBeNull();
      act(() => vi.setSystemTime(5_000));
      view.rerender(<RunWorkflowHeader runId="run" status="running" result={active} />);
      act(() => vi.advanceTimersByTime(100));
      expect(screen.getByTitle('Run duration').textContent).toBe('5.1s');
      act(() => vi.advanceTimersByTime(900));
      expect(screen.getByTitle('Run duration').textContent).toBe('6s');
      view.rerender(<RunWorkflowHeader runId="run" status="success" result={completed} />);
      act(() => vi.advanceTimersByTime(5_000));
      expect(screen.getByTitle('Run duration').textContent).toBe('0ms');
    });
  });
});
