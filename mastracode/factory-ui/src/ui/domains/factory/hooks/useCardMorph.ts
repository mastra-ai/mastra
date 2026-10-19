import type { CSSProperties, RefObject } from 'react';
import { useRef, useState } from 'react';

import { useBoardRowDetails } from '../context/useBoardRowDetails';

interface CardMorphStyle extends CSSProperties {
  '--board-card-w'?: string;
  '--board-card-h'?: string;
}

export interface CardMorph {
  cardRef: RefObject<HTMLElement | null>;
  setCardElement: (element: HTMLElement | null) => void;
  panelRef: RefObject<HTMLDivElement | null>;
  open: boolean;
  // False until the first open: a board holds hundreds of cards.
  mounted: boolean;
  openDetails: () => void;
  closeDetails: () => void;
}

/**
 * The size the panel grows out of, read off the live card rather than stored at open time.
 * A list row spans the page, so the panel starts from a reading width instead: stretched to the row,
 * its few lines sat at opposite edges of a mostly empty box.
 */
export function cardMorphStyle(card: HTMLElement | null): CardMorphStyle {
  const rect = card?.getBoundingClientRect();
  if (!rect) return {};
  return { '--board-card-w': `min(${rect.width}px, 36rem)`, '--board-card-h': `${rect.height}px` };
}

/**
 * `openFor` is the deep link the card is the target of: a link decides the panel
 * is open, a click or a dismissal overrides it until the next link arrives.
 * The popover root mounts on the first open and stays, so the collapse still has something to run on.
 */
export function useCardMorph({ openFor }: { openFor?: string } = {}): CardMorph {
  const cardRef = useRef<HTMLElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const setCardElement = (element: HTMLElement | null) => {
    cardRef.current = element;
  };
  const [choice, setChoice] = useState<{ openFor?: string; open: boolean }>();
  const setRowDetailsOpen = useBoardRowDetails();
  const [closedBefore, setClosedBefore] = useState(false);

  const chosen = choice?.openFor === openFor ? choice : undefined;
  const open = chosen?.open ?? openFor !== undefined;

  return {
    cardRef,
    setCardElement,
    panelRef,
    open,
    mounted: open || closedBefore,
    openDetails: () => {
      setChoice({ openFor, open: true });
      setRowDetailsOpen(true);
    },
    closeDetails: () => {
      setClosedBefore(true);
      setChoice({ openFor, open: false });
      setRowDetailsOpen(false);
    },
  };
}
