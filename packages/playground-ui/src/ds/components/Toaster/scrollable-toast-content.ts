function contentOverflows(content: HTMLElement) {
  const style = getComputedStyle(content);
  const childrenHeight = Array.from(content.children).reduce((height, child) => {
    const childStyle = getComputedStyle(child);
    return (
      height +
      Number.parseFloat(childStyle.height) +
      Number.parseFloat(childStyle.marginTop) +
      Number.parseFloat(childStyle.marginBottom)
    );
  }, 0);
  const contentHeight =
    childrenHeight +
    Number.parseFloat(style.rowGap) * Math.max(0, content.childElementCount - 1) +
    Number.parseFloat(style.paddingTop) +
    Number.parseFloat(style.paddingBottom);
  return Math.round(contentHeight) > content.clientHeight;
}

export function measureScrollableToastContent(root: HTMLElement) {
  const measurements = Array.from(root.querySelectorAll<HTMLElement>('[data-content]'), content => ({
    content,
    overflows: contentOverflows(content),
  }));
  return () => {
    for (const { content, overflows } of measurements) {
      if (overflows && content.tabIndex !== 0) content.tabIndex = 0;
      else if (!overflows && content.hasAttribute('tabindex')) content.removeAttribute('tabindex');
    }
  };
}
