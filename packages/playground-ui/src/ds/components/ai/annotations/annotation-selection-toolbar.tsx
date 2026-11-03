import { Popover as PopoverPrimitive } from '@base-ui/react/popover';
import { TextQuote } from 'lucide-react';
import type { RefObject } from 'react';

import type { NewChatAnnotation } from './chat-annotations';
import { useAnnotationSelection } from './use-annotation-selection';
import { Button } from '@/ds/components/Button';
import { FLOATING_POSITION_METHOD } from '@/ds/primitives/floating';
import { usePortalContainer } from '@/ds/primitives/portal-container';
import { overlaySurfaceStyle } from '@/ds/primitives/raised-surface';
import { cn } from '@/lib/utils';

export interface AnnotationSelectionToolbarProps {
  /** The transcript. Text selected inside one message's content within it can be annotated. */
  containerRef: RefObject<HTMLElement | null>;
  /** Receives the selected text, already trimmed, and where it sits, when the person picks Add to chat. */
  onAnnotate: (annotation: NewChatAnnotation) => void;
}

/**
 * Floats Add to chat above text selected in a message. It renders nothing until there is such a
 * selection, so mount it once next to the transcript.
 */
export function AnnotationSelectionToolbar({ containerRef, onAnnotate }: AnnotationSelectionToolbarProps) {
  const { open, selection, dismiss } = useAnnotationSelection(containerRef);
  const container = usePortalContainer();

  const addToChat = () => {
    if (!selection) return;
    // Cleared first: the consumer usually focuses its composer next, and that must keep its caret.
    document.getSelection()?.removeAllRanges();
    dismiss();
    onAnnotate({ text: selection.text, source: selection.source });
  };

  return (
    <PopoverPrimitive.Root
      open={open}
      modal={false}
      onOpenChange={next => {
        if (!next) dismiss();
      }}
    >
      <PopoverPrimitive.Portal container={container}>
        <PopoverPrimitive.Positioner
          anchor={selection?.anchor}
          side="top"
          align="start"
          sideOffset={8}
          collisionPadding={8}
          positionMethod={FLOATING_POSITION_METHOD}
          className="z-50 outline-none data-[anchor-hidden]:invisible"
        >
          <PopoverPrimitive.Popup
            role="toolbar"
            aria-label="Selected text"
            initialFocus={false}
            finalFocus={false}
            // A press here must not collapse the selection it acts on.
            onMouseDown={event => event.preventDefault()}
            data-slot="annotation-selection-toolbar"
            className={cn(
              'flex origin-(--transform-origin) items-center rounded-full p-1 focus-visible:outline-hidden',
              overlaySurfaceStyle,
              'motion-safe:data-[closed]:animate-out motion-safe:data-[closed]:fade-out-0 motion-safe:data-[closed]:zoom-out-95',
              'motion-safe:data-[open]:animate-in motion-safe:data-[open]:fade-in-0 motion-safe:data-[open]:zoom-in-95',
            )}
          >
            <Button type="button" variant="ghost" size="sm" icon={<TextQuote />} onClick={addToChat}>
              Add to chat
            </Button>
          </PopoverPrimitive.Popup>
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
