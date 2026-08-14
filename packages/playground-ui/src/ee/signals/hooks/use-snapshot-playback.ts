import { useEffect } from 'react';

type SnapshotPlaybackOptions<SnapshotCursor> = {
  isPlaying: boolean;
  isPlaybackBlocked: boolean;
  nextSnapshot: SnapshotCursor | undefined;
  onAdvance: (snapshot: SnapshotCursor | undefined) => void;
  snapshotCount: number;
};

export function useSnapshotPlayback<SnapshotCursor>({
  isPlaying,
  isPlaybackBlocked,
  nextSnapshot,
  onAdvance,
  snapshotCount,
}: SnapshotPlaybackOptions<SnapshotCursor>) {
  useEffect(() => {
    if (!isPlaying || snapshotCount < 2 || isPlaybackBlocked) return;

    const timer = window.setTimeout(() => onAdvance(nextSnapshot), 900);
    return () => window.clearTimeout(timer);
  }, [isPlaybackBlocked, isPlaying, nextSnapshot, onAdvance, snapshotCount]);
}
