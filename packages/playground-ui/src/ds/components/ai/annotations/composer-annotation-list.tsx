import { TextQuote, X } from 'lucide-react';
import { useState } from 'react';

import { rangeFromSource } from './annotatable-selection';
import { AnnotationNumber } from './annotation-number';
import type { ChatAnnotation } from './chat-annotations';
import { Button } from '@/ds/components/Button';
import { Popover, PopoverContent, PopoverTrigger } from '@/ds/components/Popover';
import { focusRing } from '@/ds/primitives/transitions';
import { cn } from '@/lib/utils';

export interface ComposerAnnotationListProps {
  annotations: readonly ChatAnnotation[];
  onRemove: (id: string) => void;
}

const countLabel = (count: number) => (count === 1 ? '1 annotation' : `${count} annotations`);

/** Scrolls the transcript to where the annotation was selected, if that message is still on the page. */
function revealSource(annotation: ChatAnnotation): boolean {
  const range = annotation.source && rangeFromSource(annotation.source);
  const target = range?.startContainer.parentElement;
  if (!target) return false;
  target.scrollIntoView({ block: 'center', behavior: 'smooth' });
  return true;
}

/**
 * The annotations waiting for the next message, as one chip at the top of `ComposerBox`. It opens their
 * numbered list with their comments, where each one can be found in the transcript or removed. Renders nothing while
 * no annotation is waiting.
 */
export function ComposerAnnotationList({ annotations, onRemove }: ComposerAnnotationListProps) {
  const [open, setOpen] = useState(false);
  if (annotations.length === 0) return null;

  return (
    <div data-slot="composer-annotations" className="flex px-2 pt-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger type="button" size="sm">
          <TextQuote aria-hidden="true" />
          {countLabel(annotations.length)}
        </PopoverTrigger>
        <PopoverContent align="start" side="top" className="flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-1 p-1.5">
          <ol aria-label="Annotations" className="flex flex-col">
            {annotations.map((annotation, index) => (
              <li key={annotation.id} className="flex items-start gap-2 rounded-lg p-1.5">
                <AnnotationNumber className="mt-px">{index + 1}</AnnotationNumber>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  {annotation.source ? (
                    <button
                      type="button"
                      title="Show in chat"
                      className={cn(
                        'line-clamp-3 cursor-pointer rounded-xs text-left text-body-sm whitespace-pre-line text-muted-foreground hover:text-foreground',
                        focusRing,
                      )}
                      onClick={() => {
                        if (revealSource(annotation)) setOpen(false);
                      }}
                    >
                      {annotation.text}
                    </button>
                  ) : (
                    <p className="line-clamp-3 text-body-sm whitespace-pre-line text-muted-foreground">
                      {annotation.text}
                    </p>
                  )}
                  {annotation.comment?.trim() && (
                    <p className="line-clamp-2 text-body-sm whitespace-pre-line text-foreground">
                      {annotation.comment.trim()}
                    </p>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="-my-1"
                  tooltip={`Remove annotation ${index + 1}`}
                  onClick={() => onRemove(annotation.id)}
                >
                  <X />
                </Button>
              </li>
            ))}
          </ol>
          {annotations.length > 1 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="self-end"
              onClick={() => {
                for (const annotation of annotations) onRemove(annotation.id);
              }}
            >
              Remove all
            </Button>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
