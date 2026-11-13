import { afterEach, vi } from 'vitest';

// Node-environment tests load this too, so the browser setup is guarded.
if (typeof globalThis.window !== 'undefined') {
  const { cleanup } = await import('@testing-library/react');
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  afterEach(() => cleanup());
  // The ext-apps postMessage transport logs every message it parses with console.debug.
  vi.spyOn(console, 'debug').mockImplementation(() => {});

  // The ext-apps App reports its size to the host through a ResizeObserver.
  if (typeof globalThis.ResizeObserver === 'undefined') {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  // Base UI's ScrollArea, in the table widget, calls getAnimations; jsdom has no Web Animations API.
  Element.prototype.getAnimations ??= () => [];
}
