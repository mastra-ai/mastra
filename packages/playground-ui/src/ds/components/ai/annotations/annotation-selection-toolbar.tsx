import { Popover as PopoverPrimitive } from '@base-ui/react/popover';
import { TextQuote } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';

import type { NewChatAnnotation } from './chat-annotations';
import { useAnnotationSelection } from './use-annotation-selection';
import { Button } from '@/ds/components/Button';
import { FLOATING_POSITION_METHOD } from '@/ds/primitives/floating';
import { usePortalContainer } from '@/ds/primitives/portal-container';
import { overlaySurfaceStyle } from '@/ds/primitives/raised-surface';
import { cn } from '@/lib/utils';

export interface AnnotationSelectionToolbarProps {
  containerRef: RefObject<HTMLElement | null>;
  onAnnotate: (annotation: NewChatAnnotation) => void;
}

export function AnnotationSelectionToolbar({ containerRef, onAnnotate }: AnnotationSelectionToolbarProps) {
  const toolbarRef = useRef<HTMLDivElement>(null);
  const { open, selection, dismiss } = useAnnotationSelection(containerRef, toolbarRef);
  const container = usePortalContainer();
  const addRef = useRef<HTMLElement>(null);
  const actionsRef = useRef<PopoverPrimitive.Root.Actions>(null);

  useEffect(() => {
    if (!open) return;
    let origin: HTMLElement | undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      const add = addRef.current;
      const transcript = containerRef.current;
      if (!add || !transcript || event.altKey || event.ctrlKey || event.metaKey) return;
      const focused = document.activeElement;
      // Without a trigger Base UI cannot route focus out of the toolbar, so it goes back to the scroller it came from.
      if (focused === add) {
        if (!origin || (event.key !== 'Tab' && event.key !== 'Escape')) return;
        if (event.key === 'Tab') {
          event.preventDefault();
          actionsRef.current?.close();
        }
        origin.focus();
        return;
      }
      const holdsTranscript =
        focused instanceof HTMLElement && focused !== document.body && focused.contains(transcript);
      if (event.key !== 'Tab' || event.shiftKey || !holdsTranscript) return;
      add.focus();
      if (document.activeElement !== add) {
        actionsRef.current?.close();
        return;
      }
      event.preventDefault();
      origin = focused;
    };
    // Capture: Base UI handles Escape on the way up and stops it there.
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [open, containerRef]);

  const addToChat = () => {
    if (!selection) return;
    // Cleared first: the consumer usually focuses its composer next, and that must keep its caret.
    document.getSelection()?.removeAllRanges();
    dismiss();
    onAnnotate({ text: selection.text, source: selection.source });
  };

  return (
    <PopoverPrimitive.Root
      actionsRef={actionsRef}
      open={open}
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
            ref={toolbarRef}
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
            <Button ref={addRef} type="button" variant="ghost" size="sm" icon={<TextQuote />} onClick={addToChat}>
              Add to chat
            </Button>
          </PopoverPrimitive.Popup>
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
