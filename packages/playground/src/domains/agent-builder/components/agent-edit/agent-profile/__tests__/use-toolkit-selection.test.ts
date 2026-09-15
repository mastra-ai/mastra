import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useToolkitSelection } from '../use-toolkit-selection';

describe('useToolkitSelection', () => {
  it('starts with everything checked via the null sentinel', () => {
    const { result } = renderHook(() => useToolkitSelection(['a', 'b']));

    expect(result.current.selected).toBeNull();
    expect(result.current.isChecked('a')).toBe(true);
    expect(result.current.isChecked('b')).toBe(true);
  });

  it('selectAll restores the null sentinel so later-discovered toolkits stay checked', () => {
    const { result, rerender } = renderHook(({ ids }) => useToolkitSelection(ids), {
      initialProps: { ids: ['a', 'b'] },
    });

    act(() => result.current.clearAll());
    expect(result.current.allUnchecked).toBe(true);

    act(() => result.current.selectAll());
    expect(result.current.selected).toBeNull();

    // A toolkit that shows up after "Select all" must be checked too.
    rerender({ ids: ['a', 'b', 'c'] });
    expect(result.current.isChecked('c')).toBe(true);
  });

  it('toggle unchecks and re-checks a single toolkit', () => {
    const { result } = renderHook(() => useToolkitSelection(['a', 'b']));

    act(() => result.current.toggle('a'));
    expect(result.current.isChecked('a')).toBe(false);
    expect(result.current.isChecked('b')).toBe(true);

    act(() => result.current.toggle('a'));
    expect(result.current.isChecked('a')).toBe(true);
  });
});
