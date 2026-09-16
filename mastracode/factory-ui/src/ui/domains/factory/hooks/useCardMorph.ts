import type { CSSProperties, RefObject } from 'react';
import { useRef, useState } from 'react';

interface CardMorphStyle extends CSSProperties {
  '--board-card-w'?: string;
  '--board-card-h'?: string;
}

export interface CardMorph {
  cardRef: RefObject<HTMLElement | null>;
  panelRef: RefObject<HTMLDivElement | null>;
  open: boolean;
  // False until the first open: a board holds hundreds of cards.
  mounted: boolean;
  openDetails: () => void;
  closeDetails: () => void;
}

/** The size the panel grows out of, read off the live card rather than stored at open time. */
export function cardMorphStyle(card: HTMLElement | null): CardMorphStyle {
  const rect = card?.getBoundingClientRect();
  if (!rect) return {};
  return { '--board-card-w': `${rect.width}px`, '--board-card-h': `${rect.height}px` };
}

/**
 * `openFor` is the deep link the card is the target of: a link decides the panel
 * is open, a click or a dismissal overrides it until the next link arrives.
 * The popover root mounts on the first open and stays, so the collapse still has something to run on.
 */
export function useCardMorph({ openFor }: { openFor?: string } = {}): CardMorph {
  const cardRef = useRef<HTMLElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [choice, setChoice] = useState<{ openFor?: string; open: boolean }>();
  const [closedBefore, setClosedBefore] = useState(false);

  const chosen = choice?.openFor === openFor ? choice : undefined;
  const open = chosen?.open ?? openFor !== undefined;

  return {
    cardRef,
    panelRef,
    open,
    mounted: open || closedBefore,
    openDetails: () => setChoice({ openFor, open: true }),
    closeDetails: () => {
      setClosedBefore(true);
      setChoice({ openFor, open: false });
    },
  };
}
