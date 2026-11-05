import { TextQuote, X } from 'lucide-react';
import { useState } from 'react';

import { rangeFromSource } from './annotatable-selection';
import { AnnotationNumber } from './annotation-number';
import { visibleComment } from './chat-annotations';
import type { ChatAnnotation } from './chat-annotations';
import { Button } from '@/ds/components/Button';
import { Popover, PopoverContent, PopoverTrigger } from '@/ds/components/Popover';
import { focusRing } from '@/ds/primitives/transitions';
import { pluralize } from '@/lib/string';
import { cn } from '@/lib/utils';

export interface ComposerAnnotationListProps {
  annotations: readonly ChatAnnotation[];
  onRemove: (id: string) => void;
}

function revealSource({ source }: ChatAnnotation): boolean {
  const target = rangeFromSource(source)?.startContainer.parentElement;
  if (!target) return false;
  target.scrollIntoView({ block: 'center', behavior: 'smooth' });
  return true;
}

export function ComposerAnnotationList({ annotations, onRemove }: ComposerAnnotationListProps) {
  const [open, setOpen] = useState(false);

  return (
    <div data-slot="composer-annotations" className="flex px-2 pt-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger type="button" size="sm">
          <TextQuote aria-hidden="true" />
          {pluralize(annotations.length, 'annotation')}
        </PopoverTrigger>
        <PopoverContent
          align="start"
          side="top"
          className="flex max-h-(--available-height) w-80 max-w-[calc(100vw-2rem)] flex-col gap-1 p-1.5"
        >
          <ol aria-label="Annotations" className="flex min-h-0 flex-col overflow-y-auto">
            {annotations.map((annotation, index) => {
              const comment = visibleComment(annotation);
              return (
                <li key={annotation.id} className="flex items-start gap-2 rounded-lg p-1.5">
                  <AnnotationNumber className="mt-px">{index + 1}</AnnotationNumber>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
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
                    {comment && (
                      <p className="line-clamp-2 text-body-sm whitespace-pre-line text-foreground">{comment}</p>
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
              );
            })}
          </ol>
          {annotations.length > 1 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="shrink-0 self-end"
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
