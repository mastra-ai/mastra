import { useEffect } from 'react';

type SnapshotPlaybackOptions = {
  isPlaying: boolean;
  isPlaybackBlocked: boolean;
  nextSnapshotId: string | undefined;
  onAdvance: (snapshotId: string | undefined) => void;
  snapshotCount: number;
};

export function useSnapshotPlayback({
  isPlaying,
  isPlaybackBlocked,
  nextSnapshotId,
  onAdvance,
  snapshotCount,
}: SnapshotPlaybackOptions) {
  useEffect(() => {
    if (!isPlaying || snapshotCount < 2 || isPlaybackBlocked) return;

    const timer = window.setTimeout(() => onAdvance(nextSnapshotId), 900);
    return () => window.clearTimeout(timer);
  }, [isPlaybackBlocked, isPlaying, nextSnapshotId, onAdvance, snapshotCount]);
}
