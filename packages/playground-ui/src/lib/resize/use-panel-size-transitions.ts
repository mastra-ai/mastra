import type { RefObject } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

type PanelElementRef = RefObject<HTMLDivElement | null>;

const PANEL_SIZE_TRANSITION =
  'flex-grow 300ms var(--ease-out-custom, ease), flex-basis 300ms var(--ease-out-custom, ease)';

/**
 * Adds motion to programmatic panel-group resizes without making pointer-driven
 * resizing lag behind the cursor. The transition is disabled for reduced motion.
 */
export function usePanelSizeTransitions(elementRef: PanelElementRef, enabled = true) {
  const [booted, setBooted] = useState(false);
  const bootedRef = useRef(false);
  const bootScheduled = useRef(false);
  const enableSizeTransitionsRef = useRef<() => void>(() => {});

  const enableSizeTransitions = useCallback(() => {
    enableSizeTransitionsRef.current();
  }, []);

  const boot = useCallback(() => {
    if (bootScheduled.current) return;
    bootScheduled.current = true;
    requestAnimationFrame(() => {
      bootedRef.current = true;
      setBooted(true);
      enableSizeTransitionsRef.current();
    });
  }, []);

  useEffect(() => {
    if (!enabled || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const group = elementRef.current?.parentElement;
    if (!group) return;
    const panels = Array.from(group.children).filter(
      (child): child is HTMLElement => child instanceof HTMLElement && child.hasAttribute('data-panel'),
    );
    const separators = Array.from(group.children).filter(
      (child): child is HTMLElement => child instanceof HTMLElement && child.hasAttribute('data-separator'),
    );

    const enable = () => {
      if (!bootedRef.current) return;
      panels.forEach(panel => (panel.style.transition = PANEL_SIZE_TRANSITION));
    };
    const disable = () => panels.forEach(panel => (panel.style.transition = 'none'));

    enable();
    enableSizeTransitionsRef.current = enable;
    separators.forEach(separator => separator.addEventListener('pointerdown', disable));
    window.addEventListener('pointerup', enable);
    window.addEventListener('pointercancel', enable);
    return () => {
      enableSizeTransitionsRef.current = () => {};
      separators.forEach(separator => separator.removeEventListener('pointerdown', disable));
      window.removeEventListener('pointerup', enable);
      window.removeEventListener('pointercancel', enable);
      panels.forEach(panel => (panel.style.transition = ''));
    };
  }, [elementRef, enabled]);

  return { booted, boot, enableSizeTransitions };
}
