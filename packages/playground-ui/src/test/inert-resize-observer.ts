// Opt-in: a present ResizeObserver flips components such as @xyflow/react and react-resizable-panels
// onto their observer path, and this one never reports a size.
class InertResizeObserver implements ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = InertResizeObserver;
}

// Base UI ScrollArea calls getAnimations once a ResizeObserver exists; jsdom has no Web Animations API.
Element.prototype.getAnimations ??= () => [];

export {};
