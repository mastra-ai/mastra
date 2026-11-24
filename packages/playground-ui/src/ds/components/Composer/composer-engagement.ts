import type { PointerEvent as ReactPointerEvent } from 'react';

import { morphComposerLine } from './composer-line-motion';

const pressOwners = new WeakMap<Event, Element>();

/** React bubbles portaled pickers through the composer, so this sees presses the DOM tree does not. */
export function claimComposerPress(event: ReactPointerEvent<HTMLFormElement>) {
  pressOwners.set(event.nativeEvent, event.currentTarget);
}

/**
 * Opens the composer while its input has focus. Settles pointer presses on click, not blur: a layout
 * shift mid-press would swallow the click.
 */
export function attachComposerEngagement(root: HTMLFormElement | null) {
  if (!root) return;

  let glides: Animation[] = [];
  let press: Event | undefined;
  let pointerDown = false;

  const engaged = () => root.hasAttribute('data-engaged');
  const engage = (next: boolean) => {
    if (engaged() === next) return;
    const flip = () => (next ? root.setAttribute('data-engaged', 'true') : root.removeAttribute('data-engaged'));
    glides = morphComposerLine(root, flip, glides);
  };

  const onFocusIn = (event: FocusEvent) => {
    if (event.target instanceof HTMLElement && event.target.dataset.slot === 'composer-input') engage(true);
  };
  const onFocusOut = (event: FocusEvent) => {
    const next = event.relatedTarget;
    if (pointerDown || (next instanceof Node && root.contains(next))) return;
    if (root.querySelector('[aria-expanded="true"]')) return;
    engage(false);
  };
  // Document capture runs before React's root listener claims the press.
  const onPointerDown = (event: PointerEvent) => {
    pointerDown = true;
    press = engaged() ? event : undefined;
  };
  const onPointerUp = () => {
    pointerDown = false;
  };
  const onClick = () => {
    if (press && pressOwners.get(press) !== root) engage(false);
    press = undefined;
  };

  root.addEventListener('focusin', onFocusIn);
  root.addEventListener('focusout', onFocusOut);
  document.addEventListener('pointerdown', onPointerDown, true);
  document.addEventListener('pointerup', onPointerUp, true);
  document.addEventListener('pointercancel', onPointerUp, true);
  document.addEventListener('click', onClick, true);

  return () => {
    root.removeEventListener('focusin', onFocusIn);
    root.removeEventListener('focusout', onFocusOut);
    document.removeEventListener('pointerdown', onPointerDown, true);
    document.removeEventListener('pointerup', onPointerUp, true);
    document.removeEventListener('pointercancel', onPointerUp, true);
    document.removeEventListener('click', onClick, true);
    for (const animation of glides) animation.cancel();
  };
}
