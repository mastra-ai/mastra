import { useLayoutEffect, useRef } from 'react';

import { glideComposerStatus } from './composer-line-motion';

const GROUP_SLOTS = new Set(['composer-status-start', 'composer-status-end']);
const COLLAPSE_DELAY_MS = 600;

function shows(node: Node): boolean {
  if (node.nodeType === Node.TEXT_NODE) return (node.textContent ?? '').trim() !== '';
  if (!(node instanceof Element) || node.classList.contains('sr-only')) return false;
  return GROUP_SLOTS.has(node.getAttribute('data-slot') ?? '') ? Array.from(node.childNodes).some(shows) : true;
}

const isEmpty = (status: HTMLElement) => !Array.from(status.childNodes).some(shows);

/**
 * Marks the footer `data-empty` while nothing in it would be seen, so it gives its row back.
 * Fills at once; empties after a pause, so status that blinks out and back never bounces the composer.
 */
export function useComposerStatusPresence() {
  const statusRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const status = statusRef.current;
    if (!status) return;

    const mark = (empty: boolean) =>
      empty ? status.setAttribute('data-empty', '') : status.removeAttribute('data-empty');
    let glides: Animation[] = [];
    let collapseTimer: number | undefined;

    mark(isEmpty(status));
    const observer = new MutationObserver(() => {
      window.clearTimeout(collapseTimer);
      const empty = isEmpty(status);
      if (empty === status.hasAttribute('data-empty')) return;
      const glide = () => {
        glides = glideComposerStatus(status, () => mark(empty), glides);
      };
      if (empty) collapseTimer = window.setTimeout(glide, COLLAPSE_DELAY_MS);
      else glide();
    });
    observer.observe(status, { childList: true, subtree: true, characterData: true });

    return () => {
      observer.disconnect();
      window.clearTimeout(collapseTimer);
      for (const animation of glides) animation.cancel();
    };
  }, []);

  return statusRef;
}
