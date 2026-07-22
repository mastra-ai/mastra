import { useEffect, useState } from 'react';

import type { ThemeSnapshot } from '../types';

export function useSnapshotPlayback(snapshots: ThemeSnapshot[], isPlaybackBlocked: boolean) {
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string>();
  const [isPlaying, setIsPlaying] = useState(false);
  const matchedSnapshotIndex = snapshots.findIndex(snapshot => snapshot.snapshotId === selectedSnapshotId);
  const selectedSnapshotIndex = matchedSnapshotIndex >= 0 ? matchedSnapshotIndex : snapshots.length - 1;
  const snapshot = snapshots[selectedSnapshotIndex];
  const nextSnapshotId = snapshots[(selectedSnapshotIndex + 1) % snapshots.length]?.snapshotId;

  useEffect(() => {
    if (!isPlaying || snapshots.length < 2 || isPlaybackBlocked) return;

    const timer = window.setTimeout(() => setSelectedSnapshotId(nextSnapshotId), 900);
    return () => window.clearTimeout(timer);
  }, [isPlaybackBlocked, isPlaying, nextSnapshotId, snapshots.length]);

  return {
    isPlaying,
    selectedSnapshotIndex,
    setIsPlaying,
    snapshot,
    selectSnapshot: (index: number) => setSelectedSnapshotId(snapshots[index]?.snapshotId),
  };
}
