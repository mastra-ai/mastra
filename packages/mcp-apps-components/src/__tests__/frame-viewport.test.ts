/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { rootObserversAtFrame } from '../shared/frame-viewport';

describe('rootObserversAtFrame', () => {
  const Native = window.IntersectionObserver;
  const roots: Array<Element | Document | null | undefined> = [];

  afterEach(() => {
    window.IntersectionObserver = Native;
    roots.length = 0;
    vi.restoreAllMocks();
  });

  const install = (embedded: boolean) => {
    window.IntersectionObserver = class {
      constructor(_callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
        roots.push(options?.root);
      }
    } as unknown as typeof IntersectionObserver;
    vi.spyOn(window, 'top', 'get').mockReturnValue(embedded ? ({} as Window) : window);
    rootObserversAtFrame();
  };

  it("roots observers without a root at the app's own document inside a host frame", () => {
    install(true);
    const scroller = document.createElement('div');

    new IntersectionObserver(() => {});
    new IntersectionObserver(() => {}, { root: null });
    new IntersectionObserver(() => {}, { root: scroller });

    expect(roots).toEqual([document, document, scroller]);
  });

  it('leaves observers alone when the app is not embedded', () => {
    install(false);

    new IntersectionObserver(() => {});

    expect(roots).toEqual([undefined]);
  });
});
