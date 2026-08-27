import type { CSSProperties, RefObject } from 'react';
import { useRef, useState } from 'react';

interface CardMorphStyle extends CSSProperties {
  '--board-card-w'?: string;
  '--board-card-h'?: string;
  '--board-panel-h'?: string;
}

export interface CardMorph {
  cardRef: RefObject<HTMLElement | null>;
  panelRef: RefObject<HTMLDivElement | null>;
  open: boolean;
  // False until the first open: a board holds hundreds of cards.
  mounted: boolean;
  style: CardMorphStyle;
  openDetails: () => void;
  closeDetails: () => void;
}

// The popover root mounts on the first open and stays, so the collapse still has something to run on.
export function useCardMorph(): CardMorph {
  const cardRef = useRef<HTMLElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [style, setStyle] = useState<CardMorphStyle>({});

  const openDetails = () => {
    const card = cardRef.current?.getBoundingClientRect();
    if (card !== undefined) {
      setStyle({ '--board-card-w': `${card.width}px`, '--board-card-h': `${card.height}px` });
    }
    setMounted(true);
    setOpen(true);
  };

  return { cardRef, panelRef, open, mounted, style, openDetails, closeDetails: () => setOpen(false) };
}
