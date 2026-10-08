import { readKnowledgeDuration } from './knowledgeMotion';

type VisibilityTarget = { element: HTMLElement | SVGElement; hidden: boolean };

function setVisibility({ element, hidden }: VisibilityTarget, settled: boolean) {
  if (!hidden) element.removeAttribute('data-knowledge-hidden-settled');
  element.toggleAttribute('data-knowledge-hidden', hidden);
  element.toggleAttribute('data-knowledge-hidden-settled', hidden && settled);
  if (hidden) element.setAttribute('tabindex', '-1');
  else if (element.matches('.react-flow__node, .react-flow__edge')) element.setAttribute('tabindex', '0');
  else element.removeAttribute('tabindex');
  element.setAttribute('aria-hidden', String(hidden));
}

/** Stage native paint/compositor transitions without touching React Flow's store. */
export function animateKnowledgeVisibility(canvas: HTMLElement, targets: VisibilityTarget[]) {
  const changed = targets.filter(
    ({ element, hidden }) =>
      element.hasAttribute('data-knowledge-hidden') !== hidden ||
      (hidden && !element.hasAttribute('data-knowledge-hidden-settled')),
  );
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const duration = readKnowledgeDuration(canvas, '--duration-normal');
  let index = 0;
  let frame: number | undefined;
  let settleTimer: number | undefined;

  function tick() {
    const end = reducedMotion ? changed.length : Math.min(index + 80, changed.length);
    for (; index < end; index++) setVisibility(changed[index]!, reducedMotion);
    if (index < changed.length) frame = requestAnimationFrame(tick);
    else if (!reducedMotion) {
      // Also settle transparent markers/paths that did not emit transitionend.
      settleTimer = window.setTimeout(() => {
        for (const target of changed) {
          if (target.hidden && target.element.hasAttribute('data-knowledge-hidden'))
            target.element.setAttribute('data-knowledge-hidden-settled', '');
        }
      }, duration);
    }
  }
  if (changed.length > 0) frame = requestAnimationFrame(tick);
  return () => {
    if (frame !== undefined) cancelAnimationFrame(frame);
    window.clearTimeout(settleTimer);
  };
}
