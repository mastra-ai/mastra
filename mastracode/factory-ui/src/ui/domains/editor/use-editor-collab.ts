import { useEffect, useMemo, useState } from 'react';

import { useApiConfig } from '../../../api/config';
import type { CollabSyncResponse } from '../../../api/types';
import { createCollabSession, localCollabUser } from './editor-collab';

import type { Awareness } from 'y-protocols/awareness';
import type * as Y from 'yjs';

export interface CollabPeer {
  clientId: number;
  name: string;
  color: string;
}

/** A synced collab room bound to one file, ready for `yCollab` in CodeMirror. */
export interface CollabBinding {
  path: string;
  ytext: Y.Text;
  awareness: Awareness;
}

/**
 * Join the collab room for the active file. Returns a binding only after the
 * first server round-trip (so the shared document is authoritative before the
 * editor binds to it) plus the live list of other participants for presence
 * UI. Everything tears down and rejoins when the file changes.
 */
export function useEditorCollab(
  workspacePath: string | undefined,
  path: string | undefined,
  enabled: boolean,
  displayName?: string,
): { binding: CollabBinding | null; peers: CollabPeer[] } {
  const { client } = useApiConfig();
  const [binding, setBinding] = useState<CollabBinding | null>(null);
  const [peers, setPeers] = useState<CollabPeer[]>([]);
  const user = useMemo(() => {
    const base = localCollabUser();
    const name = displayName?.trim();
    return name ? { ...base, name } : base;
  }, [displayName]);

  useEffect(() => {
    setBinding(null);
    setPeers([]);
    // Absolute paths are read-only library files — no shared editing there.
    if (!enabled || !workspacePath || !path || path.startsWith('/')) return;
    let disposed = false;
    const session = createCollabSession(
      async body => {
        try {
          return await client.post<CollabSyncResponse>(
            `/web/workspace/collab/sync?${new URLSearchParams({ workspacePath })}`,
            body,
          );
        } catch {
          return null;
        }
      },
      path,
      user,
    );
    const updatePeers = () => {
      if (disposed) return;
      const states = [...session.awareness.getStates().entries()]
        .filter(([clientId]) => clientId !== session.doc.clientID)
        .map(([clientId, state]) => {
          const peer = (state as { user?: { name?: string; color?: string } } | null)?.user;
          return {
            clientId,
            name: peer?.name ?? 'Guest',
            color: peer?.color ?? 'var(--accent3)',
          };
        });
      setPeers(states);
    };
    session.awareness.on('change', updatePeers);
    void session.whenSynced.then(() => {
      if (!disposed) setBinding({ path, ytext: session.ytext, awareness: session.awareness });
    });
    return () => {
      disposed = true;
      session.awareness.off('change', updatePeers);
      session.destroy();
    };
  }, [client, workspacePath, path, enabled, user]);

  // Never hand out a binding for a file the surface has already left.
  return { binding: binding && binding.path === path ? binding : null, peers };
}
