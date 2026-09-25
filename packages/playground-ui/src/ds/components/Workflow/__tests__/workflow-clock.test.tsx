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

  describe('when execution starts after the clock has been mounted', () => {
    it('uses the current time immediately rather than the stopped clock snapshot', () => {
      vi.useFakeTimers();
      vi.setSystemTime(1000);
      const view = render(<WorkflowClock startedAt={1000} />);
      vi.setSystemTime(5000);
      view.rerender(<WorkflowClock startedAt={4900} isRunning />);
      expect(screen.getByText('100ms')).not.toBeNull();
    });
  });

  describe('when a running card switches to another execution', () => {
    it('starts the new clock from its own timestamp before the first tick', () => {
      vi.useFakeTimers();
      vi.setSystemTime(1000);
      const view = render(<WorkflowClock startedAt={1000} isRunning />);
      vi.setSystemTime(5000);
      view.rerender(<WorkflowClock startedAt={4800} isRunning />);
      expect(screen.getByText('200ms')).not.toBeNull();
    });
  });
});

describe('Workflow execution clock on a span that covers a suspension', () => {
  it('says the duration includes the wait rather than passing it off as execution time', () => {
    render(<WorkflowClock startedAt={1_000} endedAt={86_401_000} spansSuspension />);
    expect(screen.getByText('1d')).not.toBeNull();
    expect(screen.getByTitle('Includes time spent suspended waiting for input')).not.toBeNull();
  });

  it('claims nothing about a plain span', () => {
    render(<WorkflowClock startedAt={1_000} endedAt={1_022} />);
    expect(screen.getByText('22ms')).not.toBeNull();
    expect(screen.queryByTitle('Includes time spent suspended waiting for input')).toBeNull();
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
