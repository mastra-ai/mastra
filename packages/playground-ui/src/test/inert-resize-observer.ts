// Opt-in: a present ResizeObserver flips components such as @xyflow/react onto their observer path,
// and this one never reports a size.
class InertResizeObserver implements ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = InertResizeObserver;
}

export {};
