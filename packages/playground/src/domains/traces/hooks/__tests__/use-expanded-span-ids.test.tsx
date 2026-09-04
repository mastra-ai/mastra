// @vitest-environment jsdom
import { formatHierarchicalSpans } from '@mastra/playground-ui/domains/traces/components/format-hierarchical-spans';
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { traceASpans, traceBSpans } from '../../components/__tests__/fixtures/thread-traces';
import { useExpandedSpanIds } from '../use-expanded-span-ids';

const treeA = formatHierarchicalSpans(traceASpans.spans);
const treeB = formatHierarchicalSpans(traceBSpans.spans);
const idsA = traceASpans.spans.map(span => span.spanId);

afterEach(() => cleanup());

describe('useExpandedSpanIds', () => {
  it('expands every span by default, including once the tree arrives after an empty first render', () => {
    const { result, rerender } = renderHook(({ tree }) => useExpandedSpanIds(tree), {
      initialProps: { tree: [] as typeof treeA },
    });
    expect(result.current.expandedSpanIds).toEqual([]);

    rerender({ tree: treeA });
    expect(result.current.expandedSpanIds).toEqual(idsA);
  });

  it('lets the user collapse a node with a functional update based on the current expanded set', () => {
    const { result } = renderHook(() => useExpandedSpanIds(treeA));

    act(() => result.current.setExpandedSpanIds(current => current.filter(id => id !== idsA[0])));

    expect(result.current.expandedSpanIds).toEqual(idsA.filter(id => id !== idsA[0]));
  });

  it('keeps the user choice when the tree re-renders, and accepts a plain value update', () => {
    const { result, rerender } = renderHook(({ tree }) => useExpandedSpanIds(tree), {
      initialProps: { tree: treeA },
    });

    act(() => result.current.setExpandedSpanIds([]));
    expect(result.current.expandedSpanIds).toEqual([]);

    rerender({ tree: treeB });
    expect(result.current.expandedSpanIds).toEqual([]);
  });
});
