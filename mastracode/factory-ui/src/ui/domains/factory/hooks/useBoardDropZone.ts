import { useDropZone } from '@mastra/playground-ui/hooks/use-drop-zone';

import { CARD_MIME, readDragPayload } from '../boardDrag';
import type { DragPayload } from '../boardDrag';
import type { BoardStageId } from '../stages';

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
