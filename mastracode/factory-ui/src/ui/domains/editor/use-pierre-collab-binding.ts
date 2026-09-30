import { useEffect } from 'react';

import type { Editor, EditorCaret } from '@pierre/diffs/edit';

import type { CollabBinding } from './use-editor-collab';
import type { SurfaceAnnotation } from './PierreFileSurface';

/**
 * Cursor-only Pierre ↔ Yjs collab bridge:
 *
 * - Watches `awareness` for other participants and mirrors their carets into
 *   `Editor.setCarets()`, colored by the participant's user color.
 * - Publishes this client's caret through the same awareness channel on every
 *   Pierre selection change so peers see us the same way.
 *
 * Text-sync CRDT wiring is intentionally deferred (v1 keeps the write path on
 * the local Pierre editor). Presence + remote cursors still land now because
 * they're the visible half of collaboration.
 */
export function usePierreCollabBinding(
  editor: Editor<'file', SurfaceAnnotation, undefined> | null,
  collab: CollabBinding | null,
) {
  useEffect(() => {
    if (!editor || !collab) return;
    const { awareness, ytext } = collab;
    const localClientId = awareness.clientID;

    const pushRemoteCarets = () => {
      const carets: EditorCaret<undefined>[] = [];
      for (const [clientId, state] of awareness.getStates().entries()) {
        if (clientId === localClientId) continue;
        const cursor = (state as { cursor?: { anchor: number; head: number } } | null)?.cursor;
        const user = (state as { user?: { color?: string } } | null)?.user;
        if (!cursor) continue;
        const doc = editor.getEditState()?.document;
        if (!doc) continue;
        const anchor = doc.positionAt(Math.max(0, Math.min(cursor.anchor, doc.getText().length)));
        const focus = doc.positionAt(Math.max(0, Math.min(cursor.head, doc.getText().length)));
        carets.push({
          anchor,
          focus,
          metadata: { color: user?.color ?? 'var(--accent3)' } as EditorCaret<undefined>['metadata'],
        });
      }
      editor.setCarets(carets);
    };

    const publishLocalCursor = () => {
      const selection = editor.getViewState()?.selections?.[0];
      const doc = editor.getEditState()?.document;
      if (!selection || !doc) {
        awareness.setLocalStateField('cursor', null);
        return;
      }
      const anchor = doc.offsetAt(selection.start);
      const head = doc.offsetAt(selection.end);
      awareness.setLocalStateField('cursor', { anchor, head });
    };

    awareness.on('change', pushRemoteCarets);
    // Publish once on mount so a peer joining after us sees our caret.
    publishLocalCursor();
    pushRemoteCarets();

    // Poll editor selection at 100ms — Pierre doesn't expose a selection-only
    // subscription, so this keeps presence responsive without an event.
    const selectionTimer = setInterval(publishLocalCursor, 100);

    // Re-mirror when the shared document changes (offsets shifted).
    const onDocChange = () => pushRemoteCarets();
    ytext.observe(onDocChange);

    return () => {
      awareness.off('change', pushRemoteCarets);
      ytext.unobserve(onDocChange);
      clearInterval(selectionTimer);
      editor.setCarets([]);
      awareness.setLocalStateField('cursor', null);
    };
  }, [editor, collab]);
}
