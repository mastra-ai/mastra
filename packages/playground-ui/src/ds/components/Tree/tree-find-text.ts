export const FIND_TEXT = '[data-tree-find-index]';
export const FIND_CHUNK = '[data-tree-find-chunk]';

export function hideUntilFound(element: Element | null) {
  if (!element) return;
  element.setAttribute('hidden', 'until-found');
  element.removeAttribute('class');
  element.removeAttribute('style');
}
