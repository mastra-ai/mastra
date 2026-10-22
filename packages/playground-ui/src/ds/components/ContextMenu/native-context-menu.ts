import type { ContextMenu as ContextMenuPrimitive } from '@base-ui/react/context-menu';

/**
 * A right-press outside the open menu dismisses it; the contextmenu of that same gesture gets the browser menu
 * instead of Base UI reopening its own and blocking the native one.
 */
export function allowNativeMenuAfterRightPressOutside(details: ContextMenuPrimitive.Root.ChangeEventDetails) {
  if (details.isCanceled || details.reason !== 'outside-press') return;
  if (!(details.event instanceof MouseEvent) || details.event.button !== 2) return;

  const gesture = new AbortController();
  const options = { capture: true, signal: gesture.signal };
  window.addEventListener(
    'contextmenu',
    event => {
      gesture.abort();
      event.stopImmediatePropagation();
    },
    options,
  );
  // A press that never produces contextmenu must not leak the escape into the next gesture.
  window.addEventListener('pointerdown', () => gesture.abort(), options);
}
