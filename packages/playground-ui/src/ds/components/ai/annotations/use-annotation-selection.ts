import { useEffect, useState } from 'react';
import type { RefObject } from 'react';

import { clampSelection, findAnnotatablePart, selectionAnchor, annotationSource } from './annotatable-selection';
import type { SelectionAnchor, AnnotationSource } from './annotatable-selection';
import { normalizeAnnotationText } from './format-annotated-message';

export interface AnnotationSelection {
  text: string;
  source: AnnotationSource;
  anchor: SelectionAnchor;
}

interface AnnotationSelectionState {
  open: boolean;
  /** Kept after closing so the toolbar stays in place while it animates out. */
  selection?: AnnotationSelection;
}

const CLOSED: AnnotationSelectionState = { open: false };

const closing = (state: AnnotationSelectionState) => (state.open ? { ...state, open: false } : state);

// Firefox can hold several ranges at once; a passage is exactly one.
function singleRange(selection: Selection | null): Range | undefined {
  if (!selection || selection.isCollapsed) return undefined;
  if (selection.rangeCount !== 1) return undefined;
  return selection.getRangeAt(0);
}

export function useAnnotationSelection(containerRef: RefObject<Element | null>, toolbarRef: RefObject<Element | null>) {
  const [state, setState] = useState<AnnotationSelectionState>(CLOSED);
  const dismiss = () => setState(closing);

  useEffect(() => {
    let pressing = false;
    let settleTimer: ReturnType<typeof setTimeout> | undefined;
    const close = () => setState(closing);

    const reportSelection = (pointerReleased: boolean) => {
      const container = containerRef.current;
      const selection = document.getSelection();
      const range = singleRange(selection);
      if (!container || !selection || !range) return close();
      const part = findAnnotatablePart(container, range);
      if (!part || (part.extendsPastContent && !pointerReleased)) return close();
      if (part.extendsPastContent) clampSelection(selection, part);
      const text = normalizeAnnotationText(selection.toString());
      if (!text) return close();
      setState({ open: true, selection: { text, source: annotationSource(part), anchor: selectionAnchor(part) } });
    };

    const onPointerDown = () => {
      pressing = true;
    };
    const endPress = () => {
      pressing = false;
    };
    // Read after the browser finishes the gesture: a click inside a selection collapses it only after release.
    const onPointerUp = () => {
      pressing = false;
      clearTimeout(settleTimer);
      settleTimer = setTimeout(() => reportSelection(true));
    };
    const onSelectionChange = () => {
      // Focus moving into the toolbar can collapse the selection it acts on.
      if (toolbarRef.current?.contains(document.activeElement)) return;
      if (pressing) close();
      else reportSelection(false);
    };

    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('pointerup', onPointerUp, true);
    document.addEventListener('pointercancel', endPress, true);
    // macOS swallows the pointer release behind a context menu.
    document.addEventListener('contextmenu', endPress, true);
    document.addEventListener('selectionchange', onSelectionChange);
    return () => {
      clearTimeout(settleTimer);
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('pointerup', onPointerUp, true);
      document.removeEventListener('pointercancel', endPress, true);
      document.removeEventListener('contextmenu', endPress, true);
      document.removeEventListener('selectionchange', onSelectionChange);
    };
  }, [containerRef, toolbarRef]);

  return { open: state.open, selection: state.selection, dismiss };
}
