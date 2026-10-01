import { useCallback, useEffect, useRef } from 'react';

import type { Editor, EditorCaret, EditorChange, TextEdit } from '@pierre/diffs/edit';
import type { YTextEvent } from 'yjs';

import type { CollabBinding } from './use-editor-collab';
import type { SurfaceAnnotation } from './PierreFileSurface';

// Origin token attached to Y.Text transactions our own edits emit, so the
// observer can tell "this update came from us; do not echo it back into
// Pierre" apart from "this update came from a peer; apply to Pierre".
const LOCAL_ORIGIN = Symbol('pierre-local');

interface YjsDelta {
  retain?: number;
  insert?: string;
  delete?: number;
}

/**
 * Full Pierre ↔ Yjs bridge:
 *
 * - **Presence**: mirrors remote awareness carets into `Editor.setCarets()`
 *   and publishes this client's caret through awareness on every selection
 *   change.
 * - **Text sync**: forwards Pierre document changes as `Y.Text` deltas and
 *   applies remote deltas back through `Editor.applyEdits(edits, false)`.
 *   `LOCAL_ORIGIN` gates the observer so local edits don't loop back into
 *   Pierre.
 *
 * On first bind, the shared `Y.Text` is authoritative (server-synced), so the
 * editor is reconciled with `ytext.toString()` before the two streams begin
 * echoing to each other.
 */
export function usePierreCollabBinding(
  editor: Editor<'file', SurfaceAnnotation, undefined> | null,
  collab: CollabBinding | null,
) {
  // Track whether we're currently applying a remote Y.Text update so the
  // corresponding Pierre change event doesn't emit right back to Yjs.
  const applyingRemoteRef = useRef(false);

  const forwardLocalChanges = useCallback(
    (changes: readonly EditorChange[]) => {
      if (!collab || applyingRemoteRef.current) return;
      const { ytext } = collab;
      ytext.doc?.transact(() => {
        // Reverse-order application: later edits first so earlier offsets
        // stay valid inside the transaction.
        for (let i = changes.length - 1; i >= 0; i--) {
          const change = changes[i];
          const start = change.start;
          const deleteLength = change.end - change.start;
          if (deleteLength > 0) ytext.delete(start, deleteLength);
          if (change.text) ytext.insert(start, change.text);
        }
      }, LOCAL_ORIGIN);
    },
    [collab],
  );

  useEffect(() => {
    if (!editor || !collab) return;
    const { awareness, ytext } = collab;
    const localClientId = awareness.clientID;

    // Reconcile with the shared document on bind. The server-synced Y.Text is
    // authoritative — any local baseline mismatch is erased before the two
    // streams begin echoing.
    const currentText = editor.getEditState()?.document?.getText();
    const sharedText = ytext.toString();
    if (currentText !== undefined && currentText !== sharedText) {
      const doc = editor.getEditState()?.document;
      if (doc) {
        applyingRemoteRef.current = true;
        editor.applyEdits(
          [
            {
              range: { start: { line: 0, character: 0 }, end: doc.positionAt(currentText.length) },
              newText: sharedText,
            },
          ],
          false,
        );
        applyingRemoteRef.current = false;
      }
    }

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
    publishLocalCursor();
    pushRemoteCarets();

    // Selection poll — Pierre doesn't expose a selection-only subscription.
    const selectionTimer = setInterval(publishLocalCursor, 100);

    // Y.Text observer: apply peer deltas into Pierre unless the update
    // originated locally (guarded by LOCAL_ORIGIN transaction tag).
    const onYtextChange = (event: YTextEvent) => {
      if (event.transaction.origin === LOCAL_ORIGIN) {
        pushRemoteCarets();
        return;
      }
      const delta = event.delta as YjsDelta[] | undefined;
      if (!delta) return;
      const doc = editor.getEditState()?.document;
      if (!doc) return;
      const edits: TextEdit[] = [];
      let cursor = 0;
      for (const op of delta) {
        if (typeof op.retain === 'number') {
          cursor += op.retain;
          continue;
        }
        if (typeof op.delete === 'number') {
          edits.push({
            range: { start: doc.positionAt(cursor), end: doc.positionAt(cursor + op.delete) },
            newText: '',
          });
          continue;
        }
        if (typeof op.insert === 'string') {
          edits.push({
            range: { start: doc.positionAt(cursor), end: doc.positionAt(cursor) },
            newText: op.insert,
          });
          cursor += op.insert.length;
          continue;
        }
      }
      if (!edits.length) {
        pushRemoteCarets();
        return;
      }
      applyingRemoteRef.current = true;
      editor.applyEdits(edits, false);
      applyingRemoteRef.current = false;
      pushRemoteCarets();
    };
    ytext.observe(onYtextChange);

    return () => {
      awareness.off('change', pushRemoteCarets);
      ytext.unobserve(onYtextChange);
      clearInterval(selectionTimer);
      editor.setCarets([]);
      awareness.setLocalStateField('cursor', null);
    };
  }, [editor, collab]);

  return { forwardLocalChanges };
}
