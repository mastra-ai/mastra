import { cn } from '@mastra/playground-ui/utils/cn';
import type { DragEvent } from 'react';
import { useRef, useState } from 'react';

import { CARD_MIME, readDragPayload } from '../boardDrag';
import type { DragPayload } from '../boardDrag';
import type { BoardStageId } from '../stages';

const BOARD_CARD_SELECTOR = '[data-testid="work-item-card"], [data-testid="candidate-card"]';

function dropLinePosition(cardList: HTMLElement, pointerY: number, gapPx: number): number {
  const cards = cardList.querySelectorAll<HTMLElement>(BOARD_CARD_SELECTOR);
  if (cards.length === 0) return 0;

  for (let index = 0; index < cards.length; index += 1) {
    const card = cards.item(index);
    if (!card) continue;
    const bounds = card.getBoundingClientRect();
    if (pointerY < bounds.top + bounds.height / 2) {
      return Math.max(0, card.offsetTop - (index === 0 ? 0 : gapPx / 2));
    }
  }

  const lastCard = cards.item(cards.length - 1);
  return lastCard ? lastCard.offsetTop + lastCard.offsetHeight + gapPx / 2 : 0;
}

/** A stage that takes dropped cards; `cardListRef` is the positioned box the drop line is measured in. */
export function useBoardDropZone<TList extends HTMLElement>({
  stage,
  gapPx,
  onDrop,
}: {
  stage: BoardStageId;
  gapPx: number;
  onDrop: (payload: DragPayload, toStage: BoardStageId) => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const [dropLineTop, setDropLineTop] = useState(0);
  const cardListRef = useRef<TList>(null);

  return {
    dragOver,
    dropLineTop,
    cardListRef,
    dropZoneProps: {
      onDragOver: (event: DragEvent<HTMLElement>) => {
        if (!event.dataTransfer.types.includes(CARD_MIME)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        setDragOver(true);
        const cardList = cardListRef.current;
        if (cardList) setDropLineTop(dropLinePosition(cardList, event.clientY, gapPx));
      },
      onDragLeave: (event: DragEvent<HTMLElement>) => {
        if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return;
        setDragOver(false);
      },
      onDrop: (event: DragEvent<HTMLElement>) => {
        event.preventDefault();
        setDragOver(false);
        const payload = readDragPayload(event);
        if (payload) onDrop(payload, stage);
      },
    },
  };
}

export function BoardDropLine({ top, visible }: { top: number; visible: boolean }) {
  return (
    <div
      aria-hidden
      style={{ top }}
      className={cn(
        'pointer-events-none absolute inset-x-0 z-10 h-0.5 rounded-full bg-placeholder transition-opacity motion-reduce:transition-none',
        visible ? 'opacity-100' : 'opacity-0',
      )}
    />
  );
}
