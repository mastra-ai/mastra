import type { DragEvent } from 'react';

// Native HTML5 drag & drop; the card menus are the accessible fallback.
export const CARD_MIME = 'application/x-factory-card';

/** Who holds a card: nobody, you, an automation, or a session. */
export type BoardCardOwnerKind = 'free' | 'you' | 'automation' | 'session';

export type DragPayload = { kind: 'work-item'; id: string; fromStage: string; ownerKind: BoardCardOwnerKind };

export function setDragPayload(event: DragEvent, payload: DragPayload) {
  event.dataTransfer.setData(CARD_MIME, JSON.stringify(payload));
  event.dataTransfer.effectAllowed = 'move';
}

export function readDragPayload(dataTransfer: DataTransfer): DragPayload | undefined {
  const raw = dataTransfer.getData(CARD_MIME);
  if (!raw) return;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return;
  }
  if (!isRecord(parsed) || parsed.kind !== 'work-item') return;
  if (typeof parsed.id !== 'string' || typeof parsed.fromStage !== 'string') return;
  if (!isOwnerKind(parsed.ownerKind)) return;
  return { kind: 'work-item', id: parsed.id, fromStage: parsed.fromStage, ownerKind: parsed.ownerKind };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

const OWNER_KINDS: Record<BoardCardOwnerKind, true> = { free: true, you: true, automation: true, session: true };

function isOwnerKind(value: unknown): value is BoardCardOwnerKind {
  return typeof value === 'string' && Object.hasOwn(OWNER_KINDS, value);
}
