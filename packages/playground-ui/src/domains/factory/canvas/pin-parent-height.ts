/**
 * A ref for the only child of a box with a height transition: it keeps the box's height set to the child's, so a
 * change in what the child shows eases the box to its new size where `height: auto` would jump.
 */
export function pinParentHeight(node: HTMLElement | null) {
  const box = node?.parentElement;
  if (!node || !box) return;
  const observer = new ResizeObserver(([entry]) => {
    const height = entry?.borderBoxSize[0]?.blockSize ?? node.offsetHeight;
    box.style.height = `${height}px`;
  });
  observer.observe(node);
  return () => observer.disconnect();
}
