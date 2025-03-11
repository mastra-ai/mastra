/*
 * Checks if an element is visible and therefore relevant for LLMs to consider. We check:
 * - Size
 * - Display properties
 * - Opacity
 * If the element is a child of a previously hidden element, it should not be included, so we don't consider downstream effects of a parent element here
 */
export function isVisible(element: Element): boolean {
  const rect = element.getBoundingClientRect();
  // Ensure the element is within the viewport
  if (rect.width === 0 || rect.height === 0 || rect.top < 0 || rect.top > window.innerHeight) {
    return false;
  }
  if (!isTopElement(element, rect)) {
    return false;
  }

  const visible = element.checkVisibility({
    checkOpacity: true,
    checkVisibilityCSS: true,
  });

  return visible;
}

export function isTextVisible(element: Element): boolean {
  const range = document.createRange();
  range.selectNodeContents(element);
  const rect = range.getBoundingClientRect();

  if (rect.width === 0 || rect.height === 0 || rect.top < 0 || rect.top > window.innerHeight) {
    return false;
  }
  const parent = element.parentElement;
  if (!parent) {
    return false;
  }

  const visible = parent.checkVisibility({
    checkOpacity: true,
    checkVisibilityCSS: true,
  });

  return visible;
}

export function isTopElement(elem: Element, rect: DOMRect): boolean {
  const points = [
    { x: rect.left + rect.width * 0.25, y: rect.top + rect.height * 0.25 },
    { x: rect.left + rect.width * 0.75, y: rect.top + rect.height * 0.25 },
    { x: rect.left + rect.width * 0.25, y: rect.top + rect.height * 0.75 },
    { x: rect.left + rect.width * 0.75, y: rect.top + rect.height * 0.75 },
    { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
  ];

  return points.some(point => {
    const topEl = document.elementFromPoint(point.x, point.y);
    let current = topEl;
    while (current && current !== document.body) {
      if (current.isSameNode(elem)) {
        return true;
      }
      current = current.parentElement;
    }

    return false;
  });
}

export function isActive(element: Element): boolean {
  if (
    element.hasAttribute('disabled') ||
    element.hasAttribute('hidden') ||
    element.getAttribute('aria-disabled') === 'true'
  ) {
    return false;
  }

  return true;
}
