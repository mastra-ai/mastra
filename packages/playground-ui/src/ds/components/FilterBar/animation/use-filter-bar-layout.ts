import { useLayoutEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { FilterBarItem, FilterBarSegment } from '../types';
import { measureFilterSegment } from './filter-segment-layout';
import type { FilterSegmentLayout } from './filter-segment-layout';
import { prefersReducedFilterMotion, useFilterAnimations } from './use-filter-animations';

type LayoutKey = 'composer' | 'clear' | `chip:${string}`;
type ElementLayout = { element: HTMLElement; left: number; top: number; width: number; height: number };

export type FilterBarLayout = {
  rootRef: RefObject<HTMLDivElement | null>;
  exitLayerRef: RefObject<HTMLDivElement | null>;
  inputRef: RefObject<HTMLInputElement | HTMLButtonElement | null>;
  register: (key: LayoutKey, element: HTMLElement | null) => void;
  registerDraftSegment: (key: FilterBarSegment, element: HTMLElement | null) => void;
  registerChipSegment: (itemId: string, key: FilterBarSegment | 'surface', element: HTMLElement | null) => void;
  capture: (commitId?: string) => void;
  play: () => void;
  refresh: () => void;
  cancel: () => void;
};

function measureLayout(elements: Map<LayoutKey, HTMLElement>, root: HTMLElement) {
  const rootBox = root.getBoundingClientRect();
  return new Map(
    [...elements]
      .filter(([key, element]) => key !== 'clear' || element.offsetWidth > 0)
      .map(([key, element]): [LayoutKey, ElementLayout] => {
        const box = element.getBoundingClientRect();
        const transform = getComputedStyle(element).transform;
        const translation = transform && transform !== 'none' ? new DOMMatrixReadOnly(transform) : undefined;
        return [
          key,
          {
            element,
            left: box.left - rootBox.left - (translation?.m41 ?? 0),
            top: box.top - rootBox.top - (translation?.m42 ?? 0),
            width: box.width,
            height: box.height,
          },
        ];
      }),
  );
}

export function useFilterBarLayout(items: readonly FilterBarItem[]): FilterBarLayout {
  const animations = useFilterAnimations();
  const rootRef = useRef<HTMLDivElement>(null);
  const exitLayerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement | HTMLButtonElement | null>(null);
  const [layout] = useState<FilterBarLayout>(() => {
    const elements = new Map<LayoutKey, HTMLElement>();
    const draftSegments = new Map<FilterBarSegment, HTMLElement>();
    const chipSegments = new Map<string, HTMLElement>();
    let capturedSegments = new Map<FilterBarSegment, FilterSegmentLayout>();
    let capturedInput: FilterSegmentLayout | undefined;
    let previous: Map<LayoutKey, ElementLayout> | undefined;
    let captured: Map<LayoutKey, ElementLayout> | undefined;
    let commitId: string | undefined;
    let inputOrigin: { left: number; top: number } | undefined;
    let previousHeight = 0;

    return {
      rootRef,
      exitLayerRef,
      inputRef,
      register(key, element) {
        if (element) elements.set(key, element);
        else elements.delete(key);
      },
      registerDraftSegment(key, element) {
        if (element) draftSegments.set(key, element);
        else draftSegments.delete(key);
      },
      registerChipSegment(itemId, key, element) {
        if (element) chipSegments.set(`${itemId}:${key}`, element);
        else chipSegments.delete(`${itemId}:${key}`);
      },
      capture(nextCommitId) {
        const root = rootRef.current;
        if (!root) return;
        const rootBox = root.getBoundingClientRect();
        captured = new Map(
          [...elements]
            .filter(([key, element]) => key !== 'clear' || element.offsetWidth > 0)
            .map(([key, element]) => {
              const box = element.getBoundingClientRect();
              return [
                key,
                {
                  element,
                  left: box.left - rootBox.left,
                  top: box.top - rootBox.top,
                  width: box.width,
                  height: box.height,
                },
              ];
            }),
        );
        previousHeight = rootBox.height;
        commitId = nextCommitId;
        capturedSegments = new Map([...draftSegments].map(([key, element]) => [key, measureFilterSegment(element)]));
        const input = inputRef.current;
        if (input) {
          capturedInput = measureFilterSegment(input);
          const box = input.getBoundingClientRect();
          inputOrigin = { left: box.left - rootBox.left, top: box.top - rootBox.top };
        }
      },
      play() {
        const root = rootRef.current;
        const exitLayer = exitLayerRef.current;
        if (!root || !exitLayer) return;
        if (captured) animations.cancel();
        const next = measureLayout(elements, root);
        const nextHeight = root.offsetHeight;
        const before = captured ?? previous;
        const unchanged =
          before?.size === next.size &&
          [...next].every(([key, current]) => {
            const old = before?.get(key);
            return old?.left === current.left && old.top === current.top && old.width === current.width;
          });
        if (!captured && unchanged) return;
        animations.cancel();
        if (before) {
          for (const [key, old] of before) {
            if (next.has(key) || !key.startsWith('chip:')) continue;
            const element = old.element;
            element.setAttribute('inert', '');
            element.setAttribute('aria-hidden', 'true');
            Object.assign(element.style, {
              position: 'absolute',
              left: `${old.left}px`,
              top: `${old.top}px`,
              width: `${old.width}px`,
              height: `${old.height}px`,
            });
            exitLayer.append(element);
            animations.run(element, [{ opacity: 1 }, { opacity: 0, transform: 'translateY(-2px)' }], () =>
              element.remove(),
            );
          }
          for (const [key, current] of next) {
            const old = key === `chip:${commitId}` ? before.get('composer') : before.get(key);
            const isCommittedInput = key === 'composer' && commitId && inputRef.current instanceof HTMLInputElement;
            let origin = isCommittedInput && inputOrigin ? inputOrigin : old;
            if (isCommittedInput && !capturedSegments.has('value') && capturedInput && inputOrigin) {
              const gap = Number.parseFloat(getComputedStyle(root).columnGap) || 0;
              origin = { left: inputOrigin.left + capturedInput.box.width + gap, top: inputOrigin.top };
            }
            if (key === 'composer' && commitId && !isCommittedInput) continue;
            if (origin) {
              const deltaX = origin.left - current.left;
              const deltaY = origin.top - current.top;
              if (deltaX || deltaY)
                animations.run(current.element, [
                  { transform: `translate(${deltaX}px, ${deltaY}px)` },
                  { transform: 'translate(0, 0)' },
                ]);
            }
            if (!before.has(key) && key.startsWith('chip:') && !prefersReducedFilterMotion()) {
              current.element.setAttribute('data-activated', '');
            }
            if (key === 'clear' && !before.has(key)) {
              animations.run(current.element, [{ opacity: 0 }, { opacity: 0, offset: 0.3 }, { opacity: 1 }]);
            }
          }
          if (commitId && inputRef.current instanceof HTMLInputElement) {
            const surface = chipSegments.get(`${commitId}:surface`);
            const wrapper = next.get(`chip:${commitId}`);
            if (surface && wrapper) {
              const hasValuePreview = capturedSegments.has('value');
              const lastSegment = capturedSegments.get('value') ?? capturedInput;
              const firstSegment = capturedSegments.get('field');
              const width = lastSegment && firstSegment ? lastSegment.box.right - firstSegment.box.left : wrapper.width;
              const remove = chipSegments.get(`${commitId}:remove`);
              const removeWidth = remove?.getBoundingClientRect().width ?? 0;
              const targets = new Map<FilterBarSegment, FilterSegmentLayout>();
              for (const segment of ['field', 'operator', 'value'] satisfies FilterBarSegment[]) {
                const element = chipSegments.get(`${commitId}:${segment}`);
                if (element) targets.set(segment, measureFilterSegment(element));
              }
              animations.holdWidth(wrapper.element, wrapper.width);
              animations.run(surface, [
                { width: `${width}px`, maxWidth: 'none' },
                { width: `${wrapper.width}px`, maxWidth: 'none' },
              ]);
              for (const [segment, target] of targets) {
                const origin = capturedSegments.get(segment) ?? capturedInput;
                if (origin) animations.run(target.element, [origin.frame, target.frame]);
              }
              if (remove) animations.reveal(remove, removeWidth);
              if (!hasValuePreview) {
                const input = inputRef.current;
                const inputWidth = input.getBoundingClientRect().width;
                const composer = next.get('composer');
                if (composer) animations.holdWidth(composer.element, composer.width);
                animations.reveal(input, inputWidth);
              }
            }
          }
          if (previousHeight && previousHeight !== nextHeight)
            animations.run(root, [{ height: `${previousHeight}px` }, { height: `${nextHeight}px` }]);
        }
        previous = next;
        previousHeight = nextHeight;
        captured = undefined;
        commitId = undefined;
      },
      refresh() {
        if (rootRef.current) previous = measureLayout(elements, rootRef.current);
      },
      cancel() {
        animations.cancel();
        for (const element of elements.values()) element.removeAttribute('data-activated');
        previous = undefined;
        captured = undefined;
      },
    };
  });

  useLayoutEffect(() => layout.play(), [items, layout]);
  useLayoutEffect(() => {
    const root = rootRef.current;
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(() => layout.refresh());
    if (root) observer?.observe(root);
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const cancelReducedMotion = () => {
      if (media?.matches) layout.cancel();
    };
    media?.addEventListener('change', cancelReducedMotion);
    return () => {
      observer?.disconnect();
      media?.removeEventListener('change', cancelReducedMotion);
      layout.cancel();
    };
  }, [layout]);

  return layout;
}
