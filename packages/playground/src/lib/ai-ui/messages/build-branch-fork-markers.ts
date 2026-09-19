import type { ThreadBranchesInfo } from '@/domains/memory/hooks';

export interface BranchForkMarkerData {
  kind: 'origin' | 'child';
  targetThreadId: string;
  targetTitle?: string;
  timestamp: string | Date;
}

/**
 * Maps fork-point message ids to the markers to render beneath them. The own
 * fork point (when the current thread is a branch) points back to the parent;
 * every direct child branch adds a marker at its fork message on this thread.
 */
export const buildBranchForkMarkers = (
  lineage: ThreadBranchesInfo | null | undefined,
): Map<string, BranchForkMarkerData[]> => {
  const markers = new Map<string, BranchForkMarkerData[]>();
  if (!lineage?.isSupported) return markers;

  const push = (messageId: string, marker: BranchForkMarkerData) => {
    const list = markers.get(messageId);
    if (list) {
      list.push(marker);
    } else {
      markers.set(messageId, [marker]);
    }
  };

  if (lineage.fork && lineage.parentThread) {
    push(lineage.fork.branchPointMessageId, {
      kind: 'origin',
      targetThreadId: lineage.parentThread.id,
      targetTitle: lineage.parentThread.title,
      timestamp: lineage.fork.branchCreatedAt,
    });
  }

  for (const { thread, branch } of lineage.branches) {
    push(branch.branchPointMessageId, {
      kind: 'child',
      targetThreadId: thread.id,
      targetTitle: thread.title,
      timestamp: branch.branchCreatedAt,
    });
  }

  return markers;
};
