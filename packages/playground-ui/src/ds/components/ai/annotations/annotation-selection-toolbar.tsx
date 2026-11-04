import { Popover as PopoverPrimitive } from '@base-ui/react/popover';
import { TextQuote } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, RefObject } from 'react';

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

const hasModifier = (event: KeyboardEvent | ReactKeyboardEvent) => event.altKey || event.ctrlKey || event.metaKey;

export function AnnotationSelectionToolbar({ containerRef, onAnnotate }: AnnotationSelectionToolbarProps) {
  const toolbarRef = useRef<HTMLDivElement>(null);
  const { open, selection, dismiss } = useAnnotationSelection(containerRef, toolbarRef);
  const portalContainer = usePortalContainer();
  const addRef = useRef<HTMLElement>(null);
  const actionsRef = useRef<PopoverPrimitive.Root.Actions>(null);
  const originRef = useRef<HTMLElement>(undefined);

  useEffect(() => {
    if (!open) return;
    // Focus sits on the scroller around the transcript, outside anything this component renders.
    const onKeyDown = (event: KeyboardEvent) => {
      const add = addRef.current;
      const transcript = containerRef.current;
      const { target } = event;
      if (!add || !transcript || hasModifier(event)) return;
      const holdsTranscript = target instanceof HTMLElement && target !== document.body && target.contains(transcript);
      if (event.key !== 'Tab' || event.shiftKey || !holdsTranscript) return;
      add.focus();
      if (document.activeElement !== add) {
        actionsRef.current?.close();
        return;
      }
      event.preventDefault();
      originRef.current = target;
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      originRef.current = undefined;
    };
  }, [open, containerRef]);

  // Without a trigger Base UI cannot route focus out of the toolbar, so it goes back to the scroller it came from.
  const returnFocus = (event: ReactKeyboardEvent) => {
    const origin = originRef.current;
    if (!origin || hasModifier(event)) return;
    if (event.key !== 'Tab' && event.key !== 'Escape') return;
    if (event.key === 'Tab') {
      event.preventDefault();
      actionsRef.current?.close();
    }
    origin.focus();
  };

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
      <PopoverPrimitive.Portal container={portalContainer}>
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
            <Button
              ref={addRef}
              type="button"
              variant="ghost"
              size="sm"
              icon={<TextQuote />}
              onClick={addToChat}
              onKeyDown={returnFocus}
            >
              Add to chat
            </Button>
          </PopoverPrimitive.Popup>
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
