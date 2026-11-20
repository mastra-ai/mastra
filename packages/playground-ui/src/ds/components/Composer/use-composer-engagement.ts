import type { FocusEvent } from 'react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import { morphComposerLine } from './composer-line-motion';

/**
 * Settles pointer presses on click, not blur: a layout shift mid-press would swallow the click.
 * A press counts as the composer's own when React bubbles it here, which covers its portaled pickers.
 */
export function useComposerEngagement() {
  const rootRef = useRef<HTMLFormElement>(null);
  const [engaged, setEngaged] = useState(false);
  const glidesRef = useRef<Animation[]>([]);
  const pressOwnedRef = useRef(false);

  // Set here rather than rendered: the glide reads the layout before the attribute flips it.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || root.hasAttribute('data-engaged') === engaged) return;
    const engage = () => (engaged ? root.setAttribute('data-engaged', 'true') : root.removeAttribute('data-engaged'));
    glidesRef.current = morphComposerLine(root, engage, glidesRef.current);
  }, [engaged]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || !engaged) return;

    const owns = (target: EventTarget | null) => target instanceof Node && root.contains(target);
    const holdsPopup = () => root.querySelector('[aria-expanded="true"]') !== null;
    let pointerDown = false;
    let pressed = false;

    // Capture on the document runs before React's root listener marks the press as owned.
    const onPointerDown = () => {
      pointerDown = true;
      pressed = true;
      pressOwnedRef.current = false;
    };
    const onPointerUp = () => {
      pointerDown = false;
    };
    const onClick = () => {
      if (pressed && !pressOwnedRef.current) setEngaged(false);
      pressed = false;
    };
    const onFocusOut = (event: globalThis.FocusEvent) => {
      if (pointerDown || owns(event.relatedTarget) || holdsPopup()) return;
      setEngaged(false);
    };

    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('pointerup', onPointerUp, true);
    document.addEventListener('pointercancel', onPointerUp, true);
    document.addEventListener('click', onClick, true);
    root.addEventListener('focusout', onFocusOut);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('pointerup', onPointerUp, true);
      document.removeEventListener('pointercancel', onPointerUp, true);
      document.removeEventListener('click', onClick, true);
      root.removeEventListener('focusout', onFocusOut);
    };
  }, [engaged]);

  const onFocus = (event: FocusEvent<HTMLFormElement>) => {
    if (event.target instanceof HTMLElement && event.target.dataset.slot === 'composer-input') setEngaged(true);
  };

  const onPointerDownCapture = () => {
    pressOwnedRef.current = true;
  };

  return { rootRef, onFocus, onPointerDownCapture };
}
