import type { DragEvent } from 'react';

import type { BoardCandidate } from './boardCandidates';

// Native HTML5 drag & drop; the card menus are the accessible fallback.
export const CARD_MIME = 'application/x-factory-card';

export type DragPayload =
  | { kind: 'work-item'; id: string; fromStage: string }
  | {
      kind: 'candidate';
      candidate: Pick<BoardCandidate, 'source' | 'sourceKey' | 'title' | 'url' | 'metadata'>;
    };

export function setDragPayload(event: DragEvent, payload: DragPayload) {
  event.dataTransfer.setData(CARD_MIME, JSON.stringify(payload));
  event.dataTransfer.effectAllowed = 'move';
}

export function readDragPayload(event: DragEvent): DragPayload | null {
  const raw = event.dataTransfer.getData(CARD_MIME);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DragPayload;
  } catch {
    return null;
  }
}
