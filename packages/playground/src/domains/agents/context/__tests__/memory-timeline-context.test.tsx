// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { MemoryTimelineProvider, useMemoryTimeline } from '../memory-timeline-context';

function wrapper({ children }: { children: ReactNode }) {
  return <MemoryTimelineProvider>{children}</MemoryTimelineProvider>;
}

describe('MemoryTimelineProvider', () => {
  it('starts closed with no selected timestamp', () => {
    const { result } = renderHook(() => useMemoryTimeline(), { wrapper });
    expect(result.current.isPanelOpen).toBe(false);
    expect(result.current.selectedTimestamp).toBeNull();
  });

  it('opens and closes the panel', () => {
    const { result } = renderHook(() => useMemoryTimeline(), { wrapper });

    act(() => result.current.openPanel());
    expect(result.current.isPanelOpen).toBe(true);

    act(() => result.current.closePanel());
    expect(result.current.isPanelOpen).toBe(false);
  });

  it('sets and clears the replay cursor', () => {
    const { result } = renderHook(() => useMemoryTimeline(), { wrapper });

    act(() => result.current.setSelectedTimestamp(1717236000000));
    expect(result.current.selectedTimestamp).toBe(1717236000000);

    act(() => result.current.setSelectedTimestamp(null));
    expect(result.current.selectedTimestamp).toBeNull();
  });

  it('returns a no-op fallback when used without a provider', () => {
    const { result } = renderHook(() => useMemoryTimeline());
    expect(result.current.isPanelOpen).toBe(false);
    expect(result.current.selectedTimestamp).toBeNull();
    // no-ops should not throw
    act(() => {
      result.current.openPanel();
      result.current.setSelectedTimestamp(123);
    });
    expect(result.current.isPanelOpen).toBe(false);
  });
});
