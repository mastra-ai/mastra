import { cleanup, configure } from '@testing-library/react';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { server } from './server';

configure({ asyncUtilTimeout: 5000 });
Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, writable: true });
Object.defineProperty(window, 'matchMedia', {
  value: (media: string) => ({
    media,
    matches: false,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
  }),
});
Object.defineProperty(globalThis, 'IntersectionObserver', {
  value: class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
});
Object.defineProperty(globalThis, 'ResizeObserver', {
  value: class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
});
Object.defineProperty(window, 'PointerEvent', { value: MouseEvent });
Element.prototype.scrollTo = () => {};
Element.prototype.scrollIntoView = () => {};
Element.prototype.getAnimations = () => [];
// Real list virtualization needs a measurable viewport in jsdom.
Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, get: () => 600 });
Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, get: () => 1000 });
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  localStorage.clear();
});
afterAll(async () => {
  await new Promise(resolve => setTimeout(resolve, 200));
  server.close();
});
