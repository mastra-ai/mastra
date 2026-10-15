// @vitest-environment jsdom
import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { firstOutsideRun, secondOutsideRun, standaloneRun } from '../../components/__tests__/fixtures/trace-span-panel';
import { useTraceSpanNavigation } from '../use-trace-span-navigation';

const spans = [secondOutsideRun, standaloneRun, firstOutsideRun];

afterEach(() => cleanup());

describe('useTraceSpanNavigation', () => {
  it('follows the grouped timeline order and never steps onto the "Started outside Mastra" row', () => {
    const onSpanChange = vi.fn();
    const { result } = renderHook(() =>
      useTraceSpanNavigation(spans, 'span-run-1', onSpanChange, { groupExternalRoots: true }),
    );

    expect(result.current.timelineSpanIds).toEqual(['span-run-1', 'span-run-2', 'span-standalone']);
    expect(result.current.handlePreviousSpan).toBeUndefined();

    result.current.handleNextSpan?.();
    expect(onSpanChange).toHaveBeenCalledWith('span-run-2');
  });
});
