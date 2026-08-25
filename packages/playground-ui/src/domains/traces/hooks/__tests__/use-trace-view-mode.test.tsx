// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useTraceViewMode } from '../use-trace-view-mode';

beforeEach(() => window.localStorage.clear());

describe('useTraceViewMode', () => {
  describe('when no preference has been saved', () => {
    it('starts in review mode', () => {
      const { result } = renderHook(() => useTraceViewMode());

      expect(result.current.viewMode).toBe('review');
    });
  });

  describe('when the user changes modes', () => {
    it('updates the current mode immediately', () => {
      const { result } = renderHook(() => useTraceViewMode());

      act(() => result.current.setViewMode('advanced'));

      expect(result.current.viewMode).toBe('advanced');
    });

    it('remembers the selected mode under the trace view-mode key', () => {
      const first = renderHook(() => useTraceViewMode());

      act(() => first.result.current.setViewMode('advanced'));
      first.unmount();

      expect(window.localStorage.getItem('mastra:traces:view-mode')).toBe('advanced');

      const second = renderHook(() => useTraceViewMode());
      expect(second.result.current.viewMode).toBe('advanced');
    });

    it('keeps a stored review preference', () => {
      window.localStorage.setItem('mastra:traces:view-mode', 'review');

      const { result } = renderHook(() => useTraceViewMode());
      expect(result.current.viewMode).toBe('review');
    });
  });

  describe('when storage contains an invalid value', () => {
    it('falls back to review mode', () => {
      window.localStorage.setItem('mastra:traces:view-mode', 'timeline');

      const { result } = renderHook(() => useTraceViewMode());
      expect(result.current.viewMode).toBe('review');
    });
  });
});
