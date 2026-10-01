/**
 * Client side of the editor's HTTP-polled Yjs collaboration (see factory's
 * routes/collab.ts). One session per open file: a local Y.Doc + awareness
 * instance kept in sync with the server room through a poll loop that pushes
 * local CRDT updates and pulls whatever this client is missing. Polls run
 * fast right after local edits and settle to an idle cadence, so latency
 * feels near-real-time without a WebSocket transport.
 */

import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate } from 'y-protocols/awareness';
import * as Y from 'yjs';

import type { CollabSyncResponse } from '../../../api/types';

export interface CollabUser {
  name: string;
  color: string;
  colorLight: string;
}

export interface CollabSession {
  doc: Y.Doc;
  ytext: Y.Text;
  awareness: Awareness;
  /** Resolves after the first successful round-trip with the server room. */
  whenSynced: Promise<void>;
  destroy(): void;
}

export type CollabPostFn = (body: {
  path: string;
  sv: string;
  update?: string;
  awareness: { clientId: string; update: string };
}) => Promise<CollabSyncResponse | null>;

/** Marks transactions that came from the server so we don't echo them back. */
const REMOTE_ORIGIN = 'collab-remote';

const IDLE_POLL_MS = 1500;
const ACTIVE_POLL_MS = 250;

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

const PEER_COLORS: { color: string; colorLight: string }[] = [
  { color: '#30bced', colorLight: '#30bced33' },
  { color: '#6eeb83', colorLight: '#6eeb8333' },
  { color: '#ffbc42', colorLight: '#ffbc4233' },
  { color: '#ecd444', colorLight: '#ecd44433' },
  { color: '#ee6352', colorLight: '#ee635233' },
  { color: '#9ac2c9', colorLight: '#9ac2c933' },
  { color: '#8acb88', colorLight: '#8acb8833' },
  { color: '#e36bae', colorLight: '#e36bae33' },
];

/**
 * A stable per-tab color/palette slot for the local user. The display name is
 * sourced from the signed-in identity (or the user's override in settings); we
 * never invent fake names here.
 */
export function localCollabColor(): { color: string; colorLight: string } {
  const key = 'editor-collab-color';
  try {
    const stored = sessionStorage.getItem(key);
    if (stored) return JSON.parse(stored) as { color: string; colorLight: string };
  } catch {
    // Fall through to a fresh slot.
  }
  const slot = PEER_COLORS[Math.floor(Math.random() * PEER_COLORS.length)]!;
  try {
    sessionStorage.setItem(key, JSON.stringify(slot));
  } catch {
    // Session storage unavailable; palette slot is per-mount instead.
  }
  return slot;
}

export function createCollabSession(postSync: CollabPostFn, path: string, user: CollabUser): CollabSession {
  const doc = new Y.Doc();
  const ytext = doc.getText('content');
  const awareness = new Awareness(doc);
  awareness.setLocalStateField('user', user);

  let destroyed = false;
  let inflight = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: Uint8Array[] = [];
  let resolveSynced: () => void;
  const whenSynced = new Promise<void>(resolve => {
    resolveSynced = resolve;
  });

  const schedule = (ms: number) => {
    if (destroyed) return;
    clearTimeout(timer);
    timer = setTimeout(() => void sync(), ms);
  };

  doc.on('update', (update: Uint8Array, origin: unknown) => {
    if (origin === REMOTE_ORIGIN) return;
    pending.push(update);
    schedule(ACTIVE_POLL_MS);
  });
  awareness.on('update', (_changes: unknown, origin: unknown) => {
    if (origin === REMOTE_ORIGIN) return;
    schedule(ACTIVE_POLL_MS);
  });

  async function sync(): Promise<void> {
    if (destroyed || inflight) return;
    inflight = true;
    const updates = pending;
    pending = [];
    const response = await postSync({
      path,
      sv: toBase64(Y.encodeStateVector(doc)),
      ...(updates.length ? { update: toBase64(Y.mergeUpdates(updates)) } : {}),
      awareness: {
        clientId: String(doc.clientID),
        update: toBase64(encodeAwarenessUpdate(awareness, [doc.clientID])),
      },
    }).catch(() => null);
    inflight = false;
    if (destroyed) return;
    if (!response) {
      // Requeue so a transient network failure doesn't drop local edits.
      pending = [...updates, ...pending];
      schedule(IDLE_POLL_MS);
      return;
    }
    if (response.update) {
      try {
        Y.applyUpdate(doc, fromBase64(response.update), REMOTE_ORIGIN);
      } catch {
        // A malformed server payload must not break the editor.
      }
    }
    for (const encoded of response.awareness) {
      try {
        applyAwarenessUpdate(awareness, fromBase64(encoded), REMOTE_ORIGIN);
      } catch {
        // Skip malformed awareness entries.
      }
    }
    resolveSynced();
    schedule(IDLE_POLL_MS);
  }

  void sync();

  return {
    doc,
    ytext,
    awareness,
    whenSynced,
    destroy() {
      destroyed = true;
      clearTimeout(timer);
      awareness.destroy();
      doc.destroy();
    },
  };
}
