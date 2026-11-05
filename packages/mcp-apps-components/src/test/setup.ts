import { afterAll, afterEach, beforeAll } from 'vitest';

// Node-environment tests load this too, so the browser setup is guarded.
if (typeof globalThis.window !== 'undefined') {
  const { server } = await import('./msw-server');
  const { cleanup, configure } = await import('@testing-library/react');
  // MSW tests await several network round-trips; the 1s default flakes under a loaded run.
  configure({ asyncUtilTimeout: 3000 });
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  afterEach(() => cleanup());

  if (!window.matchMedia) {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    });
  }

  // The ext-apps App reports its size to the host through a ResizeObserver.
  if (typeof globalThis.ResizeObserver === 'undefined') {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }

  // Only browser-side tests mock the Mastra server; Node tests talk to real servers.
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());
}
