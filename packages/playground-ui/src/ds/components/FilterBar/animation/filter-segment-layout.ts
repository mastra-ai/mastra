export type FilterSegmentLayout = {
  element: HTMLElement;
  box: DOMRect;
  frame: Keyframe;
};

export function measureFilterSegment(element: HTMLElement): FilterSegmentLayout {
  const style = getComputedStyle(element);
  const box = element.getBoundingClientRect();
  return {
    element,
    box,
    frame: {
      width: `${box.width}px`,
      marginLeft: style.marginLeft,
      borderTopLeftRadius: style.borderTopLeftRadius,
      borderBottomLeftRadius: style.borderBottomLeftRadius,
      borderTopRightRadius: style.borderTopRightRadius,
      borderBottomRightRadius: style.borderBottomRightRadius,
      minWidth: '0px',
      maxWidth: 'none',
      flexShrink: 0,
    },
  };
}
