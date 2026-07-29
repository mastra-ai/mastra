import type { DragEvent } from 'react';

import type { BoardCandidate } from './boardCandidates';
import { SOURCE_LABELS } from './boardItems';
import type { WorkItemSource } from './services/workItems';

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

export function readDragPayload(event: DragEvent): DragPayload | undefined {
  const raw = event.dataTransfer.getData(CARD_MIME);
  if (!raw) return;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return;
  }
  if (!isRecord(parsed)) return;
  if (parsed.kind === 'work-item') {
    if (typeof parsed.id !== 'string' || typeof parsed.fromStage !== 'string') return;
    return { kind: 'work-item', id: parsed.id, fromStage: parsed.fromStage };
  }
  if (parsed.kind !== 'candidate' || !isRecord(parsed.candidate)) return;
  const candidate = parsed.candidate;
  if (!isWorkItemSource(candidate.source)) return;
  if (typeof candidate.sourceKey !== 'string' || typeof candidate.title !== 'string') return;
  if (typeof candidate.url !== 'string' || !isRecord(candidate.metadata)) return;
  return {
    kind: 'candidate',
    candidate: {
      source: candidate.source,
      sourceKey: candidate.sourceKey,
      title: candidate.title,
      url: candidate.url,
      metadata: candidate.metadata,
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isWorkItemSource(value: unknown): value is WorkItemSource {
  return typeof value === 'string' && value in SOURCE_LABELS;
}
