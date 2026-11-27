import { CARD_MIME, readDragPayload } from './board-drag';

import type { DragPayload } from './board-drag';
import type { BoardStageId } from './board-icons';
import { useDropZone } from '@/hooks/use-drop-zone';

export function useBoardDropZone({
  stage,
  onDrop,
}: {
  stage: BoardStageId;
  onDrop: (payload: DragPayload, toStage: BoardStageId) => void;
}) {
  return useDropZone({
    accept: CARD_MIME,
    dropEffect: 'move',
    onDrop: dataTransfer => {
      const payload = readDragPayload(dataTransfer);
      if (payload) onDrop(payload, stage);
    },
  });
}
