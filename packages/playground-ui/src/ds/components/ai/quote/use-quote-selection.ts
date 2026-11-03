import { useEffect, useState } from 'react';
import type { RefObject } from 'react';

import { normalizeQuote } from './format-quoted-message';
import { clampSelection, findQuotablePart, quoteSelectionAnchor } from './quotable-selection';
import type { QuoteSelectionAnchor } from './quotable-selection';

export interface QuoteSelection {
  text: string;
  anchor: QuoteSelectionAnchor;
}

interface QuoteSelectionState {
  open: boolean;
  /** Kept after closing so the toolbar stays in place while it animates out. */
  selection?: QuoteSelection;
}

const CLOSED: QuoteSelectionState = { open: false };

/**
 * Follows the document selection and reports it once it rests on text in one message inside
 * `containerRef`. A drag reports when the pointer is released, not while it moves; a keyboard
 * selection reports as it changes.
 */
export function useQuoteSelection(containerRef: RefObject<Element | null>) {
  const [state, setState] = useState<QuoteSelectionState>(CLOSED);
  const dismiss = () => setState(current => (current.open ? { ...current, open: false } : current));

  useEffect(() => {
    let pressing = false;
    let settleTimer: ReturnType<typeof setTimeout> | undefined;
    const close = () => setState(current => (current.open ? { ...current, open: false } : current));

    // `settled`: the pointer was released, so a drag that ran past the message can be trimmed back to it.
    const read = (settled: boolean) => {
      const container = containerRef.current;
      const selection = document.getSelection();
      if (!container || !selection || selection.isCollapsed || selection.rangeCount === 0) return close();
      const part = findQuotablePart(container, selection.getRangeAt(0));
      if (!part || (part.spills && !settled)) return close();
      if (part.spills) clampSelection(selection, part);
      const text = normalizeQuote(selection.toString());
      if (!text) return close();
      setState({ open: true, selection: { text, anchor: quoteSelectionAnchor(part) } });
    };

    const onPointerDown = () => {
      pressing = true;
    };
    const onPointerCancel = () => {
      pressing = false;
    };
    // Read after the browser finishes the gesture: a click inside a selection collapses it only after release.
    const onPointerUp = () => {
      pressing = false;
      clearTimeout(settleTimer);
      settleTimer = setTimeout(() => read(true));
    };
    const onSelectionChange = () => {
      if (pressing) close();
      else read(false);
    };

    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('pointerup', onPointerUp, true);
    document.addEventListener('pointercancel', onPointerCancel, true);
    document.addEventListener('selectionchange', onSelectionChange);
    return () => {
      clearTimeout(settleTimer);
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('pointerup', onPointerUp, true);
      document.removeEventListener('pointercancel', onPointerCancel, true);
      document.removeEventListener('selectionchange', onSelectionChange);
    };
  }, [containerRef]);

  return { open: state.open, selection: state.selection, dismiss };
}
