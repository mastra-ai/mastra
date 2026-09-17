export type FilterElementLayout = ReturnType<typeof measureFilterElement>;
type FilterMotion = 'move' | 'hold' | 'morph' | 'width' | 'height' | 'reveal' | 'exit';

export function measureFilterElement(element: HTMLElement) {
  const box = element.getBoundingClientRect();
  const style = getComputedStyle(element);
  return {
    element,
    box,
    corners: `${style.borderTopLeftRadius} ${style.borderTopRightRadius} ${style.borderBottomRightRadius} ${style.borderBottomLeftRadius}`,
    margin: style.marginLeft,
  };
}

export function setFilterMotion(element: HTMLElement, motion: FilterMotion, properties: Record<string, string> = {}) {
  for (const [name, value] of Object.entries(properties)) element.style.setProperty(`--filter-${name}`, value);
  element.dataset.filterMotion = `${element.dataset.filterMotion ?? ''} ${motion}`.trim();
}

export function moveFilterElement(element: HTMLElement, left: number, top: number) {
  if (left || top) setFilterMotion(element, 'move', { x: `${left}px`, y: `${top}px` });
}

export function holdFilterWidth({ element, box }: FilterElementLayout) {
  setFilterMotion(element, 'hold', { width: `${box.width}px` });
}

export function morphFilterElement(origin: FilterElementLayout, target: FilterElementLayout) {
  setFilterMotion(target.element, 'morph', {
    'from-width': `${origin.box.width}px`,
    'to-width': `${target.box.width}px`,
    'from-corners': origin.corners,
    'from-margin': origin.margin,
  });
}
