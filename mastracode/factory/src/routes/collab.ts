/**
 * Real-time collaborative editing for the embedded editor, synced over HTTP
 * polling (factory can only register HTTP apiRoutes today — a WebSocket
 * transport belongs in the deployer/CLI stack and can replace the poll loop
 * later without changing the document model).
 *
 * Each open file maps to a server-held Yjs document ("room") seeded from the
 * session sandbox. Clients POST their local CRDT updates plus a state vector
 * and get back the updates they're missing — the standard Yjs sync handshake,
 * just batched per poll instead of streamed. Awareness (cursors, presence) is
 * relayed as opaque y-protocols awareness updates, one slot per client, with
 * a short TTL so closed tabs disappear.
 *
 *   - POST /web/workspace/collab/sync?workspacePath=   → push/pull doc + awareness
 */

import { Buffer } from 'node:buffer';

import { registerApiRoute } from '@mastra/core/server';
import type { ApiRoute } from '@mastra/core/server';
import type { Context } from 'hono';
import * as Y from 'yjs';

import type { SourceControlSession } from '../storage/domains/source-control/base.js';
import { resolveAuthorizedSession, sessionSandbox } from './editor.js';
import type { EditorSessionDeps } from './editor.js';

interface CollabRoom {
  doc: Y.Doc;
  /** clientId → latest awareness update for that client. */
  awareness: Map<string, { update: string; ts: number }>;
  lastAccess: number;
}

export interface CollabSyncRequest {
  path: string;
  /** Base64 Yjs state vector of the client's doc. */
  sv?: string;
  /** Base64 Yjs update with the client's local changes since the last sync. */
  update?: string;
  /** The client's own awareness update (base64, y-protocols encoding). */
  awareness?: { clientId: string; update: string };
}

export interface CollabSyncResponse {
  workspacePath: string;
  path: string;
  /** Base64 Yjs update containing everything the client is missing. */
  update: string;
  /** Other clients' latest awareness updates (base64, y-protocols encoding). */
  awareness: string[];
}

const ROOM_IDLE_MS = 10 * 60_000;
const AWARENESS_TTL_MS = 30_000;
const MAX_UPDATE_BYTES = 5 * 1024 * 1024;

const rooms = new Map<string, CollabRoom>();

function sweepRooms(now: number): void {
  for (const [key, room] of rooms) {
    if (now - room.lastAccess > ROOM_IDLE_MS) {
      room.doc.destroy();
      rooms.delete(key);
    }
  }
}

async function getRoom(session: SourceControlSession, path: string): Promise<CollabRoom> {
  const now = Date.now();
  sweepRooms(now);
  const key = `${session.sessionId}\u0000${path}`;
  const existing = rooms.get(key);
  if (existing) {
    existing.lastAccess = now;
    return existing;
  }
  const doc = new Y.Doc();
  // Seed from the file on disk so the first participant sees current content.
  // Unreadable/binary files seed empty — the client treats its buffer as the
  // initial content in that case.
  try {
    const handle = await sessionSandbox(session);
    if (handle) {
      const raw = await handle.filesystem.readFile(path);
      const text = typeof raw === 'string' ? raw : raw.toString('utf8');
      if (!text.includes('\u0000')) doc.getText('content').insert(0, text);
    }
  } catch {
    // Seed empty.
  }
  const room: CollabRoom = { doc, awareness: new Map(), lastAccess: now };
  rooms.set(key, room);
  return room;
}

function decode(base64: string): Uint8Array {
  return new Uint8Array(Buffer.from(base64, 'base64'));
}

export async function syncCollab(
  session: SourceControlSession,
  request: CollabSyncRequest,
): Promise<CollabSyncResponse> {
  const path = (request.path ?? '').trim();
  if (!path || path.startsWith('/') || path.split(/[\\/]+/).includes('..')) {
    throw new Error('path must be a relative workspace path');
  }
  const room = await getRoom(session, path);

  if (request.update) {
    if (request.update.length > MAX_UPDATE_BYTES) throw new Error('update too large');
    try {
      Y.applyUpdate(room.doc, decode(request.update));
    } catch {
      // A malformed update from one client must not poison the room.
    }
  }

  const now = Date.now();
  if (request.awareness?.clientId && request.awareness.update) {
    room.awareness.set(String(request.awareness.clientId), { update: request.awareness.update, ts: now });
  }
  for (const [clientId, entry] of room.awareness) {
    if (now - entry.ts > AWARENESS_TTL_MS) room.awareness.delete(clientId);
  }

  let update: Uint8Array;
  try {
    update = request.sv ? Y.encodeStateAsUpdate(room.doc, decode(request.sv)) : Y.encodeStateAsUpdate(room.doc);
  } catch {
    update = Y.encodeStateAsUpdate(room.doc);
  }

  const awareness = [...room.awareness.entries()]
    .filter(([clientId]) => clientId !== String(request.awareness?.clientId ?? ''))
    .map(([, entry]) => entry.update);

  return {
    workspacePath: session.sessionId,
    path,
    update: Buffer.from(update).toString('base64'),
    awareness,
  };
}

/** Register `/web/workspace/collab/sync`. */
export function buildCollabRoutes(deps: EditorSessionDeps): ApiRoute[] {
  return [
    registerApiRoute('/web/workspace/collab/sync', {
      method: 'POST',
      requiresAuth: false,
      handler: async c => {
        const workspacePath = c.req.query('workspacePath');
        if (!workspacePath) return c.json({ error: 'Missing required query param: workspacePath' }, 400);
        let body: CollabSyncRequest;
        try {
          body = (await c.req.json()) as CollabSyncRequest;
        } catch {
          return c.json({ error: 'Invalid JSON body' }, 400);
        }
        if (!body.path) return c.json({ error: 'Missing required body field: path' }, 400);
        try {
          const session = await resolveAuthorizedSession(c as Context, deps, workspacePath);
          return c.json(await syncCollab(session, body));
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          const status =
            message.includes('not available') || message.includes('current user')
              ? 403
              : message.includes('relative') || message.includes('too large')
                ? 400
                : 500;
          return c.json({ error: message }, status);
        }
      },
    }),
  ];
}
