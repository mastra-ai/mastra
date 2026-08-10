// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { FixedSankeyGeometry } from './sankey-chart-utils';
import { interpolateSankeyGeometry, useSankeyGeometryTransition } from './use-sankey-geometry-transition';

function geometry({
  nodeX,
  linkSourceX,
  linkTargetX,
}: {
  nodeX: number;
  linkSourceX: number;
  linkTargetX: number;
}): FixedSankeyGeometry {
  return {
    nodes: new Map([['theme', { x: nodeX, y: 10, centerY: 20, height: 20 }]]),
    links: new Map([
      [
        `link-${linkSourceX}`,
        {
          sourceX: linkSourceX,
          targetX: linkTargetX,
          sourceY: 20,
          targetY: 30,
          sourceWidth: 8,
          targetWidth: 10,
        },
      ],
    ]),
  };
}

describe('Sankey geometry motion', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe('when a reordered perspective replaces its adjacent links', () => {
    it('continuously morphs current nodes and ribbons from the previous geometry', () => {
      const previous = geometry({ nodeX: 20, linkSourceX: 20, linkTargetX: 120 });
      const current = geometry({ nodeX: 220, linkSourceX: 220, linkTargetX: 320 });

      const halfway = interpolateSankeyGeometry(previous, current, 0.5);

      expect(halfway.nodes.get('theme')).toMatchObject({ x: 120, y: 10, height: 20 });
      expect(halfway.links.get('link-220')).toMatchObject({ sourceX: 120, targetX: 220 });
    });
  });

  describe('when the perspective key changes', () => {
    it('publishes interpolated geometry on animation frames', () => {
      const animationFrames: FrameRequestCallback[] = [];
      vi.stubGlobal('matchMedia', () => ({ matches: false }));
      vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
        animationFrames.push(callback);
        return animationFrames.length;
      });
      vi.stubGlobal('cancelAnimationFrame', vi.fn());
      vi.spyOn(performance, 'now').mockReturnValue(0);
      const previous = geometry({ nodeX: 20, linkSourceX: 20, linkTargetX: 120 });
      const current = geometry({ nodeX: 220, linkSourceX: 220, linkTargetX: 320 });
      const { result, rerender } = renderHook(
        ({ value, transitionKey }) => useSankeyGeometryTransition({ geometry: value, transitionKey }),
        { initialProps: { value: previous, transitionKey: 'goal:sentiment' } },
      );

      rerender({ value: current, transitionKey: 'sentiment:goal' });
      const firstFrame = animationFrames[0];
      if (!firstFrame) throw new Error('Expected an animation frame');
      act(() => firstFrame(425));

      const animatedNodeX = result.current?.nodes.get('theme')?.x;
      expect(animatedNodeX).toBeGreaterThan(20);
      expect(animatedNodeX).toBeLessThan(220);
    });
  });

  describe('when the user prefers reduced motion', () => {
    it('publishes reordered geometry without scheduling an animation', () => {
      vi.stubGlobal('matchMedia', () => ({ matches: true }));
      const requestAnimationFrame = vi.fn();
      vi.stubGlobal('requestAnimationFrame', requestAnimationFrame);
      const previous = geometry({ nodeX: 20, linkSourceX: 20, linkTargetX: 120 });
      const current = geometry({ nodeX: 220, linkSourceX: 220, linkTargetX: 320 });
      const { result, rerender } = renderHook(
        ({ value, transitionKey }) => useSankeyGeometryTransition({ geometry: value, transitionKey }),
        { initialProps: { value: previous, transitionKey: 'goal:sentiment' } },
      );

      rerender({ value: current, transitionKey: 'sentiment:goal' });

      expect(result.current).toBe(current);
      expect(requestAnimationFrame).not.toHaveBeenCalled();
    });
  });
});
