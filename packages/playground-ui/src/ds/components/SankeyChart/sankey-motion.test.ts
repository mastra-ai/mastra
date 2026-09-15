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

    it('pairs replaced ribbons without consuming retained ribbon geometry', () => {
      const retained = geometry({ nodeX: 20, linkSourceX: 20, linkTargetX: 120 }).links.values().next().value;
      const replaced = geometry({ nodeX: 20, linkSourceX: 40, linkTargetX: 140 }).links.values().next().value;
      const targetRetained = geometry({ nodeX: 220, linkSourceX: 220, linkTargetX: 320 }).links.values().next().value;
      const targetReplacement = geometry({ nodeX: 220, linkSourceX: 240, linkTargetX: 340 })
        .links.values()
        .next().value;
      if (!retained || !replaced || !targetRetained || !targetReplacement) throw new Error('Expected link geometry');
      const previous = {
        nodes: new Map(),
        links: new Map([
          ['retained', retained],
          ['replaced-before', replaced],
        ]),
      } satisfies FixedSankeyGeometry;
      const current = {
        nodes: new Map(),
        links: new Map([
          ['replacement-after', targetReplacement],
          ['retained', targetRetained],
        ]),
      } satisfies FixedSankeyGeometry;

      const halfway = interpolateSankeyGeometry(previous, current, 0.5);

      expect(halfway.links.get('replacement-after')).toMatchObject({ sourceX: 140, targetX: 240 });
      expect(halfway.links.get('retained')).toMatchObject({ sourceX: 120, targetX: 220 });
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

    it('keeps animating when the reordered geometry is recalculated with the same perspective key', () => {
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
      const recalculatedCurrent = geometry({ nodeX: 220, linkSourceX: 220, linkTargetX: 320 });
      const { result, rerender } = renderHook(
        ({ value, transitionKey }) => useSankeyGeometryTransition({ geometry: value, transitionKey }),
        { initialProps: { value: previous, transitionKey: 'goal:sentiment' } },
      );

      rerender({ value: current, transitionKey: 'sentiment:goal' });
      rerender({ value: recalculatedCurrent, transitionKey: 'sentiment:goal' });

      expect(result.current?.nodes.get('theme')?.x).toBe(20);
      const firstFrame = animationFrames[0];
      if (!firstFrame) throw new Error('Expected an animation frame');
      act(() => firstFrame(425));
      expect(result.current?.nodes.get('theme')?.x).toBeGreaterThan(20);
      expect(result.current?.nodes.get('theme')?.x).toBeLessThan(220);
    });

    it('continues from the displayed geometry when another reorder interrupts the animation', () => {
      const animationFrames: FrameRequestCallback[] = [];
      vi.stubGlobal('matchMedia', () => ({ matches: false }));
      vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
        animationFrames.push(callback);
        return animationFrames.length;
      });
      vi.stubGlobal('cancelAnimationFrame', vi.fn());
      vi.spyOn(performance, 'now').mockReturnValue(0);
      const first = geometry({ nodeX: 20, linkSourceX: 20, linkTargetX: 120 });
      const second = geometry({ nodeX: 220, linkSourceX: 220, linkTargetX: 320 });
      const third = geometry({ nodeX: 420, linkSourceX: 420, linkTargetX: 520 });
      const { result, rerender } = renderHook(
        ({ value, transitionKey }) => useSankeyGeometryTransition({ geometry: value, transitionKey }),
        { initialProps: { value: first, transitionKey: 'first' } },
      );
      rerender({ value: second, transitionKey: 'second' });
      const firstTransitionFrame = animationFrames[0];
      if (!firstTransitionFrame) throw new Error('Expected the first transition frame');
      act(() => firstTransitionFrame(425));
      const displayedNodeX = result.current?.nodes.get('theme')?.x;
      if (displayedNodeX === undefined) throw new Error('Expected displayed node geometry');

      rerender({ value: third, transitionKey: 'third' });
      const interruptedTransitionFrame = animationFrames[2];
      if (!interruptedTransitionFrame) throw new Error('Expected the interrupted transition frame');
      act(() => interruptedTransitionFrame(0));

      expect(result.current?.nodes.get('theme')?.x).toBeCloseTo(displayedNodeX);
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
