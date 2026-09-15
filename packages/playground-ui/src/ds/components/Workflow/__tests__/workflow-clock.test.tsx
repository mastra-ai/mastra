// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WorkflowClock } from '../cards/workflow-clock';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('Workflow execution clock', () => {
  it('does not invent elapsed execution time for a stopped step without an end timestamp', () => {
    vi.useFakeTimers();
    render(<WorkflowClock startedAt={100} isRunning={false} />);
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByLabelText('Timing unavailable')).not.toBeNull();
  });

  it('advances a running step and stops at the reported completion time', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1000);
    const view = render(<WorkflowClock startedAt={1000} isRunning />);
    act(() => vi.advanceTimersByTime(100));
    expect(screen.getByText('100ms')).not.toBeNull();
    view.rerender(<WorkflowClock startedAt={1000} endedAt={1200} isRunning={false} />);
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByText('200ms')).not.toBeNull();
  });
});

describe('Workflow execution clock fallback', () => {
  describe('when a caller has no execution status', () => {
    it('does not assume that a missing completion time means running', () => {
      render(<WorkflowClock startedAt={100} />);
      expect(screen.getByLabelText('Timing unavailable')).not.toBeNull();
    });
  });
  describe('when timing is invalid', () => {
    it.each([
      [NaN, 100],
      [100, Infinity],
      [200, 100],
    ])('shows unavailable timing for %s to %s', (startedAt, endedAt) => {
      render(<WorkflowClock startedAt={startedAt} endedAt={endedAt} isRunning={false} />);
      expect(screen.getByLabelText('Timing unavailable')).not.toBeNull();
    });
  });
});
