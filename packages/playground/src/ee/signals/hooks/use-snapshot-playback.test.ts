import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useSnapshotPlayback } from './use-snapshot-playback';

describe('useSnapshotPlayback', () => {
  afterEach(() => vi.useRealTimers());

  it('advances after the playback interval', () => {
    vi.useFakeTimers();
    const onAdvance = vi.fn();

    renderHook(() =>
      useSnapshotPlayback({
        isPlaying: true,
        isPlaybackBlocked: false,
        nextSnapshot: 'snapshot-2',
        onAdvance,
        snapshotCount: 2,
      }),
    );
    vi.advanceTimersByTime(900);

    expect(onAdvance).toHaveBeenCalledWith('snapshot-2');
  });

  it('does not advance while playback is blocked', () => {
    vi.useFakeTimers();
    const onAdvance = vi.fn();

    renderHook(() =>
      useSnapshotPlayback({
        isPlaying: true,
        isPlaybackBlocked: true,
        nextSnapshot: 'snapshot-2',
        onAdvance,
        snapshotCount: 2,
      }),
    );
    vi.advanceTimersByTime(900);

    expect(onAdvance).not.toHaveBeenCalled();
  });

  it('does not advance a single-snapshot timeline', () => {
    vi.useFakeTimers();
    const onAdvance = vi.fn();

    renderHook(() =>
      useSnapshotPlayback({
        isPlaying: true,
        isPlaybackBlocked: false,
        nextSnapshot: 'snapshot-1',
        onAdvance,
        snapshotCount: 1,
      }),
    );
    vi.advanceTimersByTime(900);

    expect(onAdvance).not.toHaveBeenCalled();
  });
});
