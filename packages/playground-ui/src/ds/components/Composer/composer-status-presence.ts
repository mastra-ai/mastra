import { glideComposerStatus } from './composer-line-motion';

const COLLAPSE_DELAY_MS = 600;
const GRAPHICS = 'img, svg, canvas, video, progress, meter, [role="img"], [role="progressbar"], [role="meter"]';

function shows(node: Node): boolean {
  if (node.nodeType === Node.TEXT_NODE) return (node.textContent ?? '').trim() !== '';
  if (!(node instanceof HTMLElement || node instanceof SVGElement) || node.classList.contains('sr-only')) return false;
  if (node instanceof HTMLElement && node.hidden) return false;
  // A display: contents wrapper has no box of its own, so checkVisibility() calls it hidden.
  if (getComputedStyle(node).display !== 'contents' && node.checkVisibility?.() === false) return false;
  return node.matches(GRAPHICS) || Array.from(node.childNodes).some(shows);
}

const isEmpty = (status: HTMLElement) => !Array.from(status.childNodes).some(shows);

/**
 * Marks the footer `data-empty` while nothing in it would be seen, so it gives its row back.
 * Fills at once; empties after a pause, so status that blinks out and back never bounces the composer.
 */
export function observeComposerStatus(status: HTMLDivElement | null) {
  if (!status) return;

  let glides: Animation[] = [];
  let collapseTimer: number | undefined;

  const mark = (empty: boolean) =>
    empty ? status.setAttribute('data-empty', '') : status.removeAttribute('data-empty');
  const glide = (empty: boolean) => {
    glides = glideComposerStatus(status, () => mark(empty), glides);
  };
  const cancelCollapse = () => {
    window.clearTimeout(collapseTimer);
    collapseTimer = undefined;
  };

  mark(isEmpty(status));
  const observer = new MutationObserver(() => {
    const empty = isEmpty(status);
    if (!empty) cancelCollapse();
    // A pending collapse keeps its deadline, so a stream of hidden announcements cannot hold the row open.
    if (empty === status.hasAttribute('data-empty') || collapseTimer !== undefined) return;
    if (!empty) return glide(false);
    collapseTimer = window.setTimeout(() => {
      collapseTimer = undefined;
      glide(true);
    }, COLLAPSE_DELAY_MS);
  });
  observer.observe(status, {
    childList: true,
    subtree: true,
    characterData: true,
    attributeFilter: ['hidden', 'class', 'style'],
  });

  return () => {
    observer.disconnect();
    cancelCollapse();
    for (const animation of glides) animation.cancel();
  };
}
