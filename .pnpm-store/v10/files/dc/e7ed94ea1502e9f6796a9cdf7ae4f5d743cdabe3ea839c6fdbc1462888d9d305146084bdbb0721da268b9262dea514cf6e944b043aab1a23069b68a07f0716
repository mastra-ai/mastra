export default (el?: Element | null): typeof window => {
  if (el && el.ownerDocument && el.ownerDocument.defaultView) {
    return el.ownerDocument.defaultView;
  }

  return window;
};
