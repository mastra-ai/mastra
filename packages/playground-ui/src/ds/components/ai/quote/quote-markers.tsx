import { useEffect, useEffectEvent, useRef } from 'react';

import type { ChatQuote } from './chat-quotes';
import { quoteEndRect, rangeFromSource } from './quotable-selection';
import { QuoteNumber } from './quote-number';

import './quote-markers.css';

/** Named in `quote-markers.css`. One transcript per page, so one registry entry is enough. */
const HIGHLIGHT = 'chat-quote';

function paintHighlight(ranges: Range[]) {
  if (typeof CSS === 'undefined' || !('highlights' in CSS)) return;
  if (ranges.length === 0) CSS.highlights.delete(HIGHLIGHT);
  else CSS.highlights.set(HIGHLIGHT, new Highlight(...ranges));
}

export interface QuoteMarkersProps {
  quotes: readonly ChatQuote[];
}

/**
 * Numbers each waiting quote at the end of the text it came from, and tints that text. Render it
 * inside the scrolling transcript, below a positioned ancestor that scrolls with it: the marks are
 * placed in that content's coordinates, so they move with the text without listening to scroll.
 */
export function QuoteMarkers({ quotes }: QuoteMarkersProps) {
  const layerRef = useRef<HTMLDivElement>(null);

  // Written straight to the marks: layout is read after commit, and nothing else renders from it.
  const place = useEffectEvent(() => {
    const layer = layerRef.current;
    if (!layer) return;
    const origin = layer.getBoundingClientRect();
    const ranges: Range[] = [];
    layer.querySelectorAll<HTMLElement>('[data-slot="quote-marker"]').forEach((marker, index) => {
      const source = quotes[index]?.source;
      const range = source && rangeFromSource(source);
      const end = range && quoteEndRect(range);
      marker.hidden = !end;
      if (!range || !end) return;
      ranges.push(range);
      marker.style.left = `${end.right - origin.left}px`;
      marker.style.top = `${end.top - origin.top}px`;
    });
    paintHighlight(ranges);
  });

  // After every commit: the transcript renders with this layer, so a message that changed or left
  // the page is placed again without waiting for a resize.
  useEffect(() => {
    place();
  });

  // Text above a quote growing, older messages loading, or the column reflowing all resize the
  // content the marks are placed in.
  useEffect(() => {
    const layer = layerRef.current;
    const space = layer?.offsetParent ?? layer?.parentElement;
    const resize = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(() => place());
    if (space) resize?.observe(space);
    return () => {
      resize?.disconnect();
      paintHighlight([]);
    };
  }, []);

  return (
    <div
      ref={layerRef}
      aria-hidden="true"
      data-slot="quote-markers"
      // Above the transcript's own positioned parts, below the docked composer.
      className="pointer-events-none absolute inset-0 z-1"
    >
      {quotes.map((quote, index) => (
        <QuoteNumber
          key={quote.id}
          data-slot="quote-marker"
          hidden
          className="absolute -translate-x-1/3 -translate-y-2/3 shadow-raised"
        >
          {index + 1}
        </QuoteNumber>
      ))}
    </div>
  );
}
