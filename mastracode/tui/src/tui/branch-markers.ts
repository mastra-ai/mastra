import type { TUIState } from './state.js';

function addMarker(markers: Map<string, string[]>, messageId: string, line: string): void {
  const lines = markers.get(messageId) ?? [];
  lines.push(line);
  markers.set(messageId, lines);
}

/**
 * Load branch lineage for the active thread and build fork-point marker lines
 * keyed by the message ID each marker should render after.
 *
 * Source view: one line per branch forked at a message.
 * Branch view: one line at its own fork point pointing back to the parent.
 * Returns an empty map when branching is unsupported or lineage can't load —
 * history rendering must never fail because of markers.
 */
export async function loadBranchForkMarkers(state: TUIState): Promise<Map<string, string[]>> {
  const markers = new Map<string, string[]>();

  try {
    if (!state.session.thread.getId()) return markers;

    const ownBranch = await state.session.thread.getBranchInfo();
    const { branches: children } = await state.session.thread.listBranches({ perPage: false });

    if (ownBranch) {
      const parent = await state.session.thread.getParent();
      const parentLabel = parent?.title || ownBranch.parentThreadId;
      const forkedAt = new Date(ownBranch.branchCreatedAt).toLocaleString();
      addMarker(
        markers,
        ownBranch.branchPointMessageId,
        `⎇ Branched from "${parentLabel}" at ${forkedAt} — /parent to go back`,
      );
    }

    for (const entry of children) {
      const label = entry.thread.title || entry.thread.id;
      addMarker(markers, entry.branch.branchPointMessageId, `⎇ Branch "${label}" forked here — /branches to view`);
    }
  } catch {
    // Branching unsupported or lineage unavailable — render without markers.
  }

  return markers;
}
