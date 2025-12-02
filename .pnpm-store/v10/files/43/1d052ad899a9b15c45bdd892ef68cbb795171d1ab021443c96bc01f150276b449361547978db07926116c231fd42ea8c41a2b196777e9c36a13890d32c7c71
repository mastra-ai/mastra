import getClosestScrollable from './get-closest-scrollable';

export interface Env {
  closestScrollable: HTMLElement | null;
  isFixedOnPage: boolean;
}

// TODO: do this check at the same time as the closest scrollable
// in order to avoid double calling getComputedStyle
// Do this when we move to multiple scroll containers
const getIsFixed = (el?: HTMLElement | null): boolean => {
  if (!el) {
    return false;
  }
  const style: CSSStyleDeclaration = window.getComputedStyle(el);
  if (style.position === 'fixed') {
    return true;
  }
  return getIsFixed(el.parentElement);
};

export default (start: HTMLElement): Env => {
  const closestScrollable: HTMLElement | null = getClosestScrollable(start);
  const isFixedOnPage: boolean = getIsFixed(start);

  return {
    closestScrollable,
    isFixedOnPage,
  };
};
