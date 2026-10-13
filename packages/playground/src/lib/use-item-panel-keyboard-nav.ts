import { useEffect } from 'react';

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  // Events fired from inside another dialog (e.g. Radix edit/delete dialogs)
  // belong to that dialog, not the item panel.
  return Boolean(target.closest('[role="dialog"]:not([data-item-panel])'));
}

export type ItemPanelKeyboardNavOptions = {
  /** Only listen while an item panel is open. */
  active: boolean;
  /** Also move between items with ArrowUp/ArrowDown. */
  withArrowKeys?: boolean;
  onPrevious?: () => void;
  onNext?: () => void;
  onClose: () => void;
};

/**
 * Window-level keyboard navigation shared by the item list and the side panel:
 * PageUp/PageDown (and optionally ArrowUp/ArrowDown) move between items and
 * Escape closes, regardless of focus.
 */
export function useItemPanelKeyboardNav({
  active,
  withArrowKeys = false,
  onPrevious,
  onNext,
  onClose,
}: ItemPanelKeyboardNavOptions) {
  useEffect(() => {
    if (!active) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || isEditableTarget(event.target)) return;
      if (event.key === 'PageUp' || (withArrowKeys && event.key === 'ArrowUp')) {
        event.preventDefault();
        onPrevious?.();
      } else if (event.key === 'PageDown' || (withArrowKeys && event.key === 'ArrowDown')) {
        event.preventDefault();
        onNext?.();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [active, withArrowKeys, onPrevious, onNext, onClose]);
}
