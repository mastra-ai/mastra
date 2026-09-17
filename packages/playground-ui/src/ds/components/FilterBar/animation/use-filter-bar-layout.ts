import { useLayoutEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { FilterBarItem, FilterBarSegment } from '../types';
import {
  holdFilterWidth,
  measureFilterElement,
  morphFilterElement,
  moveFilterElement,
  setFilterMotion,
} from './filter-layout';
import type { FilterElementLayout } from './filter-layout';

type LayoutKey = 'composer' | 'clear' | 'input' | `chip:${string}` | `draft:${FilterBarSegment}` | `segment:${string}`;
type LayoutSnapshot = { elements: Map<LayoutKey, FilterElementLayout>; box: DOMRect; commitId?: string };

export type FilterBarLayout = {
  rootRef: RefObject<HTMLDivElement | null>;
  exitLayerRef: RefObject<HTMLDivElement | null>;
  register: (key: LayoutKey, element: HTMLElement | null) => void;
  registerDraftSegment: (key: FilterBarSegment, element: HTMLElement | null) => void;
  registerChipSegment: (itemId: string, key: FilterBarSegment | 'surface', element: HTMLElement | null) => void;
  capture: (commitId?: string) => void;
  play: () => void;
  cancel: () => void;
};

function isLayoutItem(key: LayoutKey) {
  return key === 'composer' || key === 'clear' || key.startsWith('chip:');
}

function layoutItemsUnchanged(elements: Map<LayoutKey, HTMLElement>, before: LayoutSnapshot | undefined) {
  if (!before) return false;
  const items = [...elements].filter(([key, element]) => isLayoutItem(key) && element.offsetWidth > 0);
  const previousItems = [...before.elements].filter(([key]) => isLayoutItem(key));
  return (
    items.length === previousItems.length &&
    items.every(([key, element]) => {
      const previous = before.elements.get(key);
      if (!previous) return false;
      return (
        Math.abs(element.offsetLeft - (previous.box.left - before.box.left)) < 1 &&
        Math.abs(element.offsetTop - (previous.box.top - before.box.top)) < 1 &&
        Math.abs(element.offsetWidth - previous.box.width) < 1
      );
    })
  );
}

function morphDraft(before: LayoutSnapshot, after: LayoutSnapshot) {
  const input = after.elements.get('input');
  const previousInput = before.elements.get('input');
  const composer = after.elements.get('composer');
  if (!(input?.element instanceof HTMLInputElement) || !previousInput || !composer) return;
  holdFilterWidth(composer);
  holdFilterWidth(input);
  let addedSegment = false;
  for (const [key, target] of after.elements) {
    if (!key.startsWith('draft:')) continue;
    const origin = before.elements.get(key);
    morphFilterElement(origin ?? previousInput, target);
    addedSegment ||= origin === undefined;
  }
  if (addedSegment) setFilterMotion(input.element, 'reveal');
  const inputBox = input.element.getBoundingClientRect();
  moveFilterElement(input.element, previousInput.box.left - inputBox.left, previousInput.box.top - inputBox.top);
}

function morphCommittedFilter(before: LayoutSnapshot, after: LayoutSnapshot) {
  const wrapper = after.elements.get(`chip:${before.commitId}`);
  const surface = after.elements.get(`segment:${before.commitId}:surface`);
  const input = after.elements.get('input');
  const previousInput = before.elements.get('input');
  if (!wrapper || !surface || !(input?.element instanceof HTMLInputElement) || !previousInput) return;
  const first = before.elements.get('draft:field');
  const last = before.elements.get('draft:value') ?? previousInput;
  holdFilterWidth(wrapper);
  setFilterMotion(surface.element, 'width', {
    'from-width': `${first ? last.box.right - first.box.left : wrapper.box.width}px`,
    'to-width': `${surface.box.width}px`,
  });
  for (const segment of ['field', 'operator', 'value'] satisfies FilterBarSegment[]) {
    const target = after.elements.get(`segment:${before.commitId}:${segment}`);
    if (target) morphFilterElement(before.elements.get(`draft:${segment}`) ?? previousInput, target);
  }
  const remove = after.elements.get(`segment:${before.commitId}:remove`);
  if (remove) setFilterMotion(remove.element, 'reveal');
  if (!before.elements.has('draft:value')) setFilterMotion(input.element, 'reveal');
}

export function useFilterBarLayout(items: readonly FilterBarItem[]): FilterBarLayout {
  const rootRef = useRef<HTMLDivElement>(null);
  const exitLayerRef = useRef<HTMLDivElement>(null);
  const [layout] = useState<FilterBarLayout>(() => {
    const elements = new Map<LayoutKey, HTMLElement>();
    let captured: LayoutSnapshot | undefined;
    let previous: LayoutSnapshot | undefined;

    function register(key: LayoutKey, element: HTMLElement | null) {
      if (element) elements.set(key, element);
      else elements.delete(key);
    }

    function measure(root: HTMLElement): LayoutSnapshot {
      return {
        box: root.getBoundingClientRect(),
        elements: new Map(
          [...elements]
            .filter(([key, element]) => key !== 'clear' || element.offsetWidth > 0)
            .map(([key, element]) => [key, measureFilterElement(element)]),
        ),
      };
    }

    function clearMotion() {
      rootRef.current?.removeAttribute('data-filter-motion');
      const previousElements = Array.from(previous?.elements.values() ?? [], layout => layout.element);
      for (const element of new Set([...elements.values(), ...previousElements])) {
        element.removeAttribute('data-filter-motion');
      }
      exitLayerRef.current?.replaceChildren();
    }

    return {
      rootRef,
      exitLayerRef,
      register,
      registerDraftSegment: (key, element) => register(`draft:${key}`, element),
      registerChipSegment: (itemId, key, element) => register(`segment:${itemId}:${key}`, element),
      capture(commitId) {
        const root = rootRef.current;
        if (root) captured = { ...measure(root), commitId };
      },
      play() {
        const root = rootRef.current;
        const exitLayer = exitLayerRef.current;
        if (!root || !exitLayer) return;
        const currentMotionIsUnchanged = !captured && layoutItemsUnchanged(elements, previous);
        if (currentMotionIsUnchanged) return;
        const before = captured ?? previous;
        clearMotion();
        const after = measure(root);
        previous = after;
        captured = undefined;
        if (!before || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
        for (const [key, origin] of before.elements) {
          if (!key.startsWith('chip:') || after.elements.has(key)) continue;
          origin.element.setAttribute('inert', '');
          origin.element.setAttribute('aria-hidden', 'true');
          Object.assign(origin.element.style, {
            position: 'absolute',
            left: `${origin.box.left - before.box.left}px`,
            top: `${origin.box.top - before.box.top}px`,
            width: `${origin.box.width}px`,
            height: `${origin.box.height}px`,
          });
          exitLayer.append(origin.element);
          setFilterMotion(origin.element, 'exit');
        }
        for (const [key, target] of after.elements) {
          if (!isLayoutItem(key)) continue;
          const isCommittedChip = key === `chip:${before.commitId}`;
          let origin = before.elements.get(isCommittedChip ? 'composer' : key);
          if (key === 'composer' && before.commitId) {
            const input = before.elements.get('input');
            origin = input?.element instanceof HTMLInputElement ? input : undefined;
          }
          if (origin) {
            moveFilterElement(
              target.element,
              origin.box.left - before.box.left - (target.box.left - after.box.left),
              origin.box.top - before.box.top - (target.box.top - after.box.top),
            );
          }
          if (key.startsWith('chip:') && !before.elements.has(key)) target.element.setAttribute('data-activated', '');
          if (key === 'clear' && !before.elements.has(key)) setFilterMotion(target.element, 'reveal');
        }
        if (before.commitId) morphCommittedFilter(before, after);
        else morphDraft(before, after);
        if (before.box.height !== after.box.height) {
          setFilterMotion(root, 'height', {
            'from-height': `${before.box.height}px`,
            'to-height': `${after.box.height}px`,
          });
        }
      },
      cancel() {
        clearMotion();
        for (const element of elements.values()) element.removeAttribute('data-activated');
        captured = undefined;
        previous = undefined;
      },
    };
  });

  useLayoutEffect(() => layout.play(), [items, layout]);
  useLayoutEffect(() => {
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const cancelReducedMotion = () => {
      if (media?.matches) layout.cancel();
    };
    const removeExitedElement = (event: AnimationEvent) => {
      if (event.target instanceof HTMLElement && event.target.dataset.filterMotion === 'exit') event.target.remove();
    };
    const exitLayer = exitLayerRef.current;
    exitLayer?.addEventListener('animationend', removeExitedElement);
    media?.addEventListener('change', cancelReducedMotion);
    return () => {
      exitLayer?.removeEventListener('animationend', removeExitedElement);
      media?.removeEventListener('change', cancelReducedMotion);
      layout.cancel();
    };
  }, [layout]);

  return layout;
}
