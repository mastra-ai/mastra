import { useEffect, useMemo, useState } from 'react';

import { useApiConfig } from '../../../api/config';
import type { CollabSyncResponse } from '../../../api/types';
import { useFactoryAuth } from '../../../hooks/useFactoryAuth';
import { createCollabSession, localCollabColor } from './editor-collab';

import type { Awareness } from 'y-protocols/awareness';
import type * as Y from 'yjs';

export interface CollabPeer {
  clientId: number;
  name: string;
  color: string;
}

/** A synced collab room bound to one file, consumed by the Pierre collab binding. */
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
  const auth = useFactoryAuth();
  const [binding, setBinding] = useState<CollabBinding | null>(null);
  const [peers, setPeers] = useState<CollabPeer[]>([]);
  // Prefer the user's override; fall back to the signed-in identity. We never
  // invent fake names — unknown users are 'You' locally, 'Guest' remotely.
  const localName = useMemo(() => {
    const override = displayName?.trim();
    if (override) return override;
    const identity = auth.data?.user?.name?.trim() || auth.data?.user?.email?.trim();
    return identity || 'You';
  }, [displayName, auth.data?.user?.name, auth.data?.user?.email]);
  const user = useMemo(() => ({ ...localCollabColor(), name: localName }), [localName]);

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
      // Drop our own clientId, then collapse ghosts of ourselves (prior tab
      // mounts whose awareness entries haven't expired yet) by name so the
      // bar never shows the user editing with themselves.
      const seen = new Set<string>([localName]);
      const states: CollabPeer[] = [];
      for (const [clientId, state] of session.awareness.getStates().entries()) {
        if (clientId === session.doc.clientID) continue;
        const peer = (state as { user?: { name?: string; color?: string } } | null)?.user;
        const name = peer?.name?.trim() || 'Guest';
        if (seen.has(name)) continue;
        seen.add(name);
        states.push({ clientId, name, color: peer?.color ?? 'var(--accent3)' });
      }
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
