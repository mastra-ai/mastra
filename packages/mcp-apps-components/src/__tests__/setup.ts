import { afterEach, vi } from 'vitest';

// Node-environment tests load this too, so the browser setup is guarded.
if (typeof globalThis.window !== 'undefined') {
  const { cleanup } = await import('@testing-library/react');
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  afterEach(() => cleanup());
  // The ext-apps postMessage transport logs every message it parses with console.debug.
  vi.spyOn(console, 'debug').mockImplementation(() => {});

  // jsdom doesn't lay out, so it has no `scrollIntoView`; the trace timeline scrolls the picked span into view.
  Element.prototype.scrollIntoView ??= () => {};
  // Nor text measurement, which the span payload's code editor asks for.
  Range.prototype.getClientRects ??= () =>
    ({ length: 0, item: () => null, [Symbol.iterator]: [][Symbol.iterator] }) as DOMRectList;
  Range.prototype.getBoundingClientRect ??= () => new DOMRect();

  // The ext-apps App reports its size to the host through a ResizeObserver.
  if (typeof globalThis.ResizeObserver === 'undefined') {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  // Studio's trace list loads its next page when the list's end scrolls into view.
  if (typeof globalThis.IntersectionObserver === 'undefined') {
    globalThis.IntersectionObserver = class {
      root = null;
      rootMargin = '';
      thresholds = [];
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    } as unknown as typeof IntersectionObserver;
  }
  // Base UI's scroll areas wait for animations to finish; jsdom doesn't animate.
  Element.prototype.getAnimations ??= () => [];
  // Studio's dialogs ask whether the screen is mobile-sized.
  window.matchMedia ??= (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}
