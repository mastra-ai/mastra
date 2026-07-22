import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { multiThemeSnapshotsResponse } from '../__tests__/fixtures/theme-flow';
import { useSnapshotPlayback } from './use-snapshot-playback';

describe('useSnapshotPlayback', () => {
  afterEach(() => vi.useRealTimers());

  it('starts from the latest snapshot and advances while playing', () => {
    vi.useFakeTimers();
    const snapshots = multiThemeSnapshotsResponse.snapshots;
    const { result } = renderHook(() => useSnapshotPlayback(snapshots, false));

    expect(result.current.selectedSnapshotIndex).toBe(snapshots.length - 1);

    act(() => result.current.setIsPlaying(true));
    act(() => vi.advanceTimersByTime(900));

    expect(result.current.selectedSnapshotIndex).toBe(0);
  });

  it('does not advance while playback is blocked', () => {
    vi.useFakeTimers();
    const snapshots = multiThemeSnapshotsResponse.snapshots;
    const { result } = renderHook(() => useSnapshotPlayback(snapshots, true));

    act(() => result.current.setIsPlaying(true));
    act(() => vi.advanceTimersByTime(900));

    expect(result.current.selectedSnapshotIndex).toBe(snapshots.length - 1);
  });

  it('selects a snapshot directly', () => {
    const snapshots = multiThemeSnapshotsResponse.snapshots;
    const { result } = renderHook(() => useSnapshotPlayback(snapshots, false));

    act(() => result.current.selectSnapshot(0));

    expect(result.current.snapshot?.snapshotId).toBe(snapshots[0]?.snapshotId);
  });
});
