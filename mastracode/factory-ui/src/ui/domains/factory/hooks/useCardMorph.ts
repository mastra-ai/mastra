import type { CSSProperties, RefObject } from 'react';
import { useRef, useState } from 'react';

/** The box the panel grows from, read off the card at the moment it is clicked. */
interface CardMorphStyle extends CSSProperties {
  '--board-card-w'?: string;
  '--board-card-h'?: string;
}

export interface CardMorph {
  /** The card the panel anchors to and measures itself from. */
  cardRef: RefObject<HTMLElement | null>;
  panelRef: RefObject<HTMLDivElement | null>;
  open: boolean;
  /** False until the first open: a board holds hundreds of cards. */
  mounted: boolean;
  style: CardMorphStyle;
  openDetails: () => void;
  closeDetails: () => void;
}

/**
 * A board card's detail panel, expanding out of the card itself. The panel is a
 * popover anchored over the card, so it opens at the card's own top-left corner
 * and grows from the card's measured box to its own — the shared header rows
 * stay where they were and everything else moves into place around them.
 *
 * The popover root only mounts on the first open: mounting one root per card
 * costs more than every panel that will ever be opened. Once mounted it stays,
 * so the close animation still has something to run on.
 */
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
