import { useRef } from 'react';

import { AnnotationCommentCard } from './annotation-comment-card';
import type { ChatAnnotation } from './chat-annotations';
import { Popover, PopoverContent } from '@/ds/components/Popover';

export interface CommentCard {
  id: string;
  anchor: HTMLElement;
  open: boolean;
}

export interface AnnotationCommentPopoverProps {
  card: CommentCard;
  annotation: ChatAnnotation;
  number: number;
  onCommentChange: (comment: string) => void;
  onRemove: () => void;
  onClose: () => void;
}

export function AnnotationCommentPopover({
  card,
  annotation,
  number,
  onCommentChange,
  onRemove,
  onClose,
}: AnnotationCommentPopoverProps) {
  const commentRef = useRef<HTMLTextAreaElement>(null);

  return (
    <Popover
      open={card.open}
      onOpenChange={(next, { reason, event }) => {
        const target = event instanceof FocusEvent ? event.relatedTarget : event.target;
        // The bubble's own click toggles the card, so pressing or focusing it must not close the card first.
        const towardBubble =
          (reason === 'outside-press' || reason === 'focus-out') &&
          target instanceof Node &&
          card.anchor.contains(target);
        if (!next && !towardBubble) onClose();
      }}
    >
      <PopoverContent
        anchor={card.anchor}
        side="top"
        align="start"
        sideOffset={8}
        initialFocus={commentRef}
        aria-label={`Annotation ${number}`}
        className="w-80 max-w-[calc(100vw-2rem)] p-3"
      >
        <AnnotationCommentCard
          annotation={annotation}
          number={number}
          commentRef={commentRef}
          onCommentChange={onCommentChange}
          onRemove={onRemove}
          onDone={onClose}
        />
      </PopoverContent>
    </Popover>
  );
}
