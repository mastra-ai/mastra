import { useRef, useState } from 'react';
import type { RefObject } from 'react';
import { measureFilterSegment } from './filter-segment-layout';
import type { FilterSegmentLayout } from './filter-segment-layout';
import { useFilterAnimations } from './use-filter-animations';
import type { FilterBarLayout } from './use-filter-bar-layout';

type DraftSegment = 'field' | 'operator' | 'value';
type DraftTransition = 'edit' | 'commit';

export type FilterDraftMotion = {
  registerRoot: (element: HTMLDivElement | null) => void;
  registerSegment: (key: DraftSegment, element: HTMLSpanElement | null) => void;
  capture: (transition?: DraftTransition) => void;
  play: () => void;
};

type DraftSnapshot = {
  transition: DraftTransition;
  input: FilterSegmentLayout;
  segments: Map<DraftSegment, FilterSegmentLayout>;
  ghost: Node;
};

export function useFilterDraftMotion(
  inputRef: RefObject<HTMLInputElement | null>,
  layout: FilterBarLayout,
): FilterDraftMotion {
  const animations = useFilterAnimations();
  const rootRef = useRef<HTMLDivElement>(null);
  const [motion] = useState<FilterDraftMotion>(() => {
    const segments = new Map<DraftSegment, HTMLSpanElement>();
    let snapshot: DraftSnapshot | undefined;

    return {
      registerRoot(element) {
        rootRef.current = element;
        layout.register('composer', element);
      },
      registerSegment(key, element) {
        layout.registerDraftSegment(key, element);
        if (element) segments.set(key, element);
        else segments.delete(key);
      },
      capture(transition = 'edit') {
        const root = rootRef.current;
        const input = inputRef.current;
        if (!root || !input) return;
        layout.capture();
        snapshot = {
          transition,
          input: measureFilterSegment(input),
          segments: new Map([...segments].map(([key, element]) => [key, measureFilterSegment(element)])),
          ghost: input.cloneNode(true),
        };
      },
      play() {
        const root = rootRef.current;
        const input = inputRef.current;
        const before = snapshot;
        snapshot = undefined;
        if (!root || !input || !before) return;
        animations.cancel();
        if (before.transition === 'commit') return;
        const next = new Map([...segments].map(([key, element]) => [key, measureFilterSegment(element)]));
        const inputTarget = measureFilterSegment(input);
        const added = [...next.keys()].filter(key => !before.segments.has(key));
        const removed = [...before.segments.keys()].filter(key => !next.has(key));
        layout.play();

        animations.holdWidth(root, root.getBoundingClientRect().width);
        for (const [key, current] of next) {
          const origin = before.segments.get(key) ?? before.input;
          animations.run(current.element, [origin.frame, current.frame]);
        }
        if (added.length > 0) {
          animations.revealInput(input, inputTarget.box.width);
          const inputOrigin = input.getBoundingClientRect();
          animations.run(input, [
            {
              transform: `translate(${before.input.box.left - inputOrigin.left}px, ${before.input.box.top - inputOrigin.top}px)`,
            },
            { transform: 'translate(0, 0)' },
          ]);
        } else if (removed[0]) {
          const origin = before.segments.get(removed[0]);
          if (origin) animations.run(input, [origin.frame, inputTarget.frame]);
          const ghost = before.ghost;
          const surface = layout.rootRef.current;
          if (ghost instanceof HTMLElement && surface) {
            const surfaceBox = surface.getBoundingClientRect();
            ghost.setAttribute('inert', '');
            ghost.setAttribute('aria-hidden', 'true');
            ghost.removeAttribute('id');
            ghost.removeAttribute('aria-controls');
            ghost.removeAttribute('aria-activedescendant');
            ghost.tabIndex = -1;
            Object.assign(ghost.style, {
              position: 'absolute',
              margin: '0',
              left: `${before.input.box.left - surfaceBox.left}px`,
              top: `${before.input.box.top - surfaceBox.top}px`,
              width: `${before.input.box.width}px`,
            });
            layout.exitLayerRef.current?.append(ghost);
            animations.run(ghost, [{ opacity: 1 }, { opacity: 0, offset: 0.45 }, { opacity: 0 }], () => ghost.remove());
          }
        }
      },
    };
  });
  return motion;
}
