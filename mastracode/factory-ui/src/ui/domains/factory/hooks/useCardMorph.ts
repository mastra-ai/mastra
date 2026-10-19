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
  toggleDetails: () => void;
}

/** The size the panel grows out of, read off the live card rather than stored at open time. */
export function cardMorphStyle(card: HTMLElement | null): CardMorphStyle {
  const rect = card?.getBoundingClientRect();
  if (!rect) return {};
  return { '--board-card-w': `${rect.width}px`, '--board-card-h': `${rect.height}px` };
}

/** The popover root mounts on the first open and stays, so the collapse still has something to run on. */
export function useCardMorph(): CardMorph {
  const cardRef = useRef<HTMLElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const setCardElement = (element: HTMLElement | null) => {
    cardRef.current = element;
  };
  const { open, setOpen } = useBoardRowDetails();
  const [openedBefore, setOpenedBefore] = useState(open);
  if (open && !openedBefore) setOpenedBefore(true);

  const openDetails = () => setOpen(true);
  const closeDetails = () => setOpen(false);

  return {
    cardRef,
    setCardElement,
    panelRef,
    open,
    mounted: openedBefore,
    openDetails,
    closeDetails,
    toggleDetails: open ? closeDetails : openDetails,
  };
}
