import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useMouseInteraction } from '../use-mouse-interaction';

describe('useMouseInteraction', () => {
  let frames: FrameRequestCallback[];
  let img: HTMLImageElement;
  let sendMessage: ReturnType<typeof vi.fn<(data: string) => void>>;

  const runFrame = (now: number) => {
    const queued = frames;
    frames = [];
    queued.forEach(cb => cb(now));
  };
  const move = (clientX: number, clientY: number) =>
    img.dispatchEvent(new MouseEvent('mousemove', { clientX, clientY }));
  const sentMoves = () =>
    sendMessage.mock.calls.map(([data]) => JSON.parse(data)).filter(msg => msg.eventType === 'mouseMoved');

  beforeEach(() => {
    frames = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb));
    vi.stubGlobal('cancelAnimationFrame', () => {});
    img = document.createElement('img');
    img.getBoundingClientRect = () => ({ left: 0, top: 0, width: 100, height: 100 }) as DOMRect;
    sendMessage = vi.fn<(data: string) => void>();
    renderHook(() =>
      useMouseInteraction({
        imgRef: { current: img },
        viewport: { width: 100, height: 100 },
        sendMessage,
        enabled: true,
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('when the mouse stops moving inside the throttle window', () => {
    beforeEach(() => {
      move(10, 10);
      runFrame(100);
      move(40, 50);
      runFrame(110);
      runFrame(150);
    });

    it('sends the final resting position', () => {
      expect(sentMoves().map(({ x, y }) => [x, y])).toEqual([
        [10, 10],
        [40, 50],
      ]);
    });
  });
});
