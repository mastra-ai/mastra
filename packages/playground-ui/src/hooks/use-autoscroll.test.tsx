// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAutoscroll } from './use-autoscroll';
import type { UseAutoscrollOptions } from './use-autoscroll';

vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
});

afterEach(cleanup);

function Area(options: UseAutoscrollOptions) {
  const ref = useRef<HTMLDivElement>(null);
  useAutoscroll(ref, options);
  return <div ref={ref} data-testid="area" />;
}

const HEIGHT = 100;
const CONTENT = 500;

/** jsdom has no layout: give the area a fixed viewport and content height. */
function renderArea(options: UseAutoscrollOptions) {
  render(<Area {...options} />);
  const area = screen.getByTestId('area');
  let scrollTop = 0;
  Object.defineProperties(area, {
    clientHeight: { configurable: true, value: HEIGHT },
    scrollHeight: { configurable: true, value: CONTENT },
    scrollTop: {
      configurable: true,
      get: () => scrollTop,
      set: (next: number) => {
        scrollTop = next;
      },
    },
  });
  return area;
}

async function growContent(area: HTMLElement) {
  await act(async () => {
    area.append(document.createElement('p'));
  });
}

describe('useAutoscroll', () => {
  it.each([
    { startFollowing: undefined, scrollTop: CONTENT },
    { startFollowing: false, scrollTop: 0 },
  ])(
    'with startFollowing=$startFollowing, new content leaves scrollTop at $scrollTop',
    async ({ startFollowing, scrollTop }) => {
      const area = renderArea({ startFollowing });
      await growContent(area);
      expect(area.scrollTop).toBe(scrollTop);
    },
  );

  it('reports once that following stopped when the reader scrolls up', () => {
    const onFollowingChange = vi.fn();
    const area = renderArea({ onFollowingChange });

    fireEvent.wheel(area, { deltaY: -40 });
    fireEvent.wheel(area, { deltaY: -40 });

    expect(onFollowingChange.mock.calls).toEqual([[false]]);
  });

  it('reports that following resumed when the reader scrolls back to the end', async () => {
    const onFollowingChange = vi.fn();
    const area = renderArea({ startFollowing: false, onFollowingChange });

    area.scrollTop = CONTENT - HEIGHT;
    fireEvent.scroll(area);

    expect(onFollowingChange.mock.calls).toEqual([[true]]);
    await growContent(area);
    expect(area.scrollTop).toBe(CONTENT);
  });
});
