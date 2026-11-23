// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { agentFailedResult, agentMarkdownResult } from '../../components/__tests__/fixtures/experiment-results';
import { useResultsSelection } from '../use-results-selection';

const results = [agentMarkdownResult, agentFailedResult];

describe('useResultsSelection', () => {
  describe('when nothing is selected', () => {
    it('selects every result on toggle all', () => {
      const { result } = renderHook(() => useResultsSelection(results));

      act(() => result.current.toggleSelectAll());

      expect(result.current.selectedResults).toEqual(results);
    });
  });

  describe('when every result is selected', () => {
    it('clears the selection on toggle all', () => {
      const { result } = renderHook(() => useResultsSelection(results));
      act(() => result.current.toggleSelectAll());

      act(() => result.current.toggleSelectAll());

      expect(result.current.selectedIds.size).toBe(0);
    });
  });

  describe('when some selected results are deselected', () => {
    it('keeps only the others selected', () => {
      const { result } = renderHook(() => useResultsSelection(results));
      act(() => result.current.toggleSelectAll());

      act(() => result.current.deselect([agentMarkdownResult.id]));

      expect(result.current.selectedResults).toEqual([agentFailedResult]);
    });
  });

  describe('when a selected result is no longer loaded', () => {
    it('leaves it out of the selected results', () => {
      const { result, rerender } = renderHook(({ loaded }) => useResultsSelection(loaded), {
        initialProps: { loaded: results },
      });
      act(() => result.current.toggleSelect(agentFailedResult.id));

      rerender({ loaded: [agentMarkdownResult] });

      expect(result.current.selectedResults).toEqual([]);
    });
  });
});
