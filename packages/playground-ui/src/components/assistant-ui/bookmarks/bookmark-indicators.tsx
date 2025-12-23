'use client';

import { useEffect, useState, RefObject, useCallback, useRef } from 'react';
import { useBookmarks } from '@/domains/bookmarks/context/bookmark-context';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { Bookmark, BookmarkColor } from '@/types/bookmarks';

const colorClasses: Record<BookmarkColor, string> = {
  accent1: 'bg-accent1',
  accent2: 'bg-accent2',
  accent3: 'bg-accent3',
  accent4: 'bg-accent4',
  accent5: 'bg-accent5',
  accent6: 'bg-accent6',
};

export type BookmarkIndicatorsProps = {
  scrollContainerRef: RefObject<HTMLElement | null>;
};

type IndicatorPosition = {
  bookmark: Bookmark;
  absoluteTop: number;
  messageHeight: number;
};

type VisualPosition = 'above' | 'visible' | 'below';

const INDICATOR_SIZE = 12;
const INDICATOR_GAP = 4;
const TOP_PADDING = 8;
const BOTTOM_PADDING = 8;

export function BookmarkIndicators({ scrollContainerRef }: BookmarkIndicatorsProps) {
  const { bookmarks, scrollToBookmark } = useBookmarks();
  const [positions, setPositions] = useState<IndicatorPosition[]>([]);
  const indicatorRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);

  // Calculate absolute positions of bookmarked messages (sorted by position)
  const calculatePositions = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const newPositions: IndicatorPosition[] = [];

    for (const bookmark of bookmarks) {
      const messageElement = container.querySelector(`[data-message-id="${bookmark.messageId}"]`) as HTMLElement | null;
      if (messageElement) {
        newPositions.push({
          bookmark,
          absoluteTop: messageElement.offsetTop,
          messageHeight: messageElement.offsetHeight,
        });
      }
    }

    newPositions.sort((a, b) => a.absoluteTop - b.absoluteTop);

    // Only update state if positions actually changed
    setPositions(prev => {
      if (prev.length !== newPositions.length) return newPositions;
      const changed = newPositions.some(
        (pos, i) =>
          prev[i]?.bookmark.id !== pos.bookmark.id ||
          prev[i]?.absoluteTop !== pos.absoluteTop ||
          prev[i]?.messageHeight !== pos.messageHeight,
      );
      return changed ? newPositions : prev;
    });
  }, [bookmarks, scrollContainerRef]);

  // Find the actual scrolling ancestor (the element that has overflow scroll/auto and is scrolling)
  const getScrollParent = useCallback((element: HTMLElement | null): HTMLElement | null => {
    if (!element) return null;

    let parent = element.parentElement;
    while (parent) {
      const style = getComputedStyle(parent);
      const overflowY = style.overflowY;
      // Check if this element is scrollable
      if ((overflowY === 'auto' || overflowY === 'scroll') && parent.scrollHeight > parent.clientHeight) {
        return parent;
      }
      parent = parent.parentElement;
    }
    return null;
  }, []);

  // Update indicator positions directly in DOM (called on scroll)
  const updateIndicatorPositions = useCallback(() => {
    const contentContainer = scrollContainerRef.current;
    const indicatorContainer = containerRef.current;
    if (!contentContainer || !indicatorContainer || positions.length === 0) return;

    // Find the actual scroll container (might be a parent)
    const container = getScrollParent(contentContainer) || contentContainer;
    const containerRect = container.getBoundingClientRect();
    const clientHeight = containerRect.height;

    // Update container position - position it at the right edge of the scroll container
    indicatorContainer.style.top = `${containerRect.top}px`;
    indicatorContainer.style.left = `${containerRect.right - 20}px`; // 20px from right edge of container
    indicatorContainer.style.height = `${clientHeight}px`;

    // Calculate each message's position relative to the visible viewport
    type MessageVisibility = {
      pos: IndicatorPosition;
      relativeTop: number; // position relative to container top (can be negative if above)
      relativeBottom: number;
    };

    const messageVisibilities: MessageVisibility[] = positions.map(pos => {
      const messageElement = contentContainer.querySelector(
        `[data-message-id="${pos.bookmark.messageId}"]`,
      ) as HTMLElement | null;
      if (!messageElement) {
        return { pos, relativeTop: -9999, relativeBottom: -9999 };
      }
      const messageRect = messageElement.getBoundingClientRect();
      return {
        pos,
        relativeTop: messageRect.top - containerRect.top,
        relativeBottom: messageRect.bottom - containerRect.top,
      };
    });

    // Determine visual position for each bookmark based on viewport-relative position
    const getVisualPosition = (mv: MessageVisibility): VisualPosition => {
      if (mv.relativeBottom < 0) return 'above';
      if (mv.relativeTop > clientHeight) return 'below';
      return 'visible';
    };

    // Categorize bookmarks
    const aboveBookmarks: MessageVisibility[] = [];
    const visibleBookmarks: MessageVisibility[] = [];
    const belowBookmarks: MessageVisibility[] = [];

    for (const mv of messageVisibilities) {
      const visualPos = getVisualPosition(mv);
      if (visualPos === 'above') aboveBookmarks.push(mv);
      else if (visualPos === 'below') belowBookmarks.push(mv);
      else visibleBookmarks.push(mv);
    }

    // Calculate stack heights
    const topStackHeight = aboveBookmarks.length * (INDICATOR_SIZE + INDICATOR_GAP) + TOP_PADDING;
    const bottomStackHeight = belowBookmarks.length * (INDICATOR_SIZE + INDICATOR_GAP) + BOTTOM_PADDING;

    // Update each indicator's position
    for (const mv of messageVisibilities) {
      const el = indicatorRefs.current.get(mv.pos.bookmark.id);
      if (!el) continue;

      const visualPos = getVisualPosition(mv);

      // Reset styles
      el.style.top = '';
      el.style.bottom = '';

      if (visualPos === 'above') {
        const aboveIndex = aboveBookmarks.indexOf(mv);
        const topValue = TOP_PADDING + aboveIndex * (INDICATOR_SIZE + INDICATOR_GAP);
        el.style.top = `${topValue}px`;
      } else if (visualPos === 'below') {
        const belowIndex = belowBookmarks.indexOf(mv);
        const fromBottom = belowBookmarks.length - 1 - belowIndex;
        const bottomValue = BOTTOM_PADDING + fromBottom * (INDICATOR_SIZE + INDICATOR_GAP);
        el.style.bottom = `${bottomValue}px`;
      } else {
        // Visible - position at same height as message, clamped to usable area
        const visibleIndex = visibleBookmarks.indexOf(mv);
        const idealTop = mv.relativeTop;

        // Ensure minimum spacing from previous visible bookmark
        let finalTop = idealTop;
        if (visibleIndex > 0) {
          const prevMv = visibleBookmarks[visibleIndex - 1];
          const prevEl = indicatorRefs.current.get(prevMv.pos.bookmark.id);
          if (prevEl) {
            const prevTop = parseFloat(prevEl.style.top) || 0;
            const minTop = prevTop + INDICATOR_SIZE + INDICATOR_GAP;
            finalTop = Math.max(idealTop, minTop);
          }
        }

        // Clamp to stay within usable area (between stacked bookmarks)
        const clampedTop = Math.max(
          topStackHeight,
          Math.min(finalTop, clientHeight - bottomStackHeight - INDICATOR_SIZE),
        );
        el.style.top = `${clampedTop}px`;
      }
    }
  }, [positions, scrollContainerRef, getScrollParent]);

  // Set up event listeners
  useEffect(() => {
    calculatePositions();

    const contentContainer = scrollContainerRef.current;
    if (!contentContainer) return;

    // Find the actual scroll container
    const scrollContainer = getScrollParent(contentContainer) || contentContainer;

    // Initial position update
    requestAnimationFrame(updateIndicatorPositions);

    // Scroll handler
    const handleScroll = () => {
      requestAnimationFrame(updateIndicatorPositions);
    };

    scrollContainer.addEventListener('scroll', handleScroll, { passive: true });

    const observer = new MutationObserver(() => {
      calculatePositions();
      requestAnimationFrame(updateIndicatorPositions);
    });
    observer.observe(contentContainer, { childList: true, subtree: true });

    const resizeObserver = new ResizeObserver(() => {
      calculatePositions();
      requestAnimationFrame(updateIndicatorPositions);
    });
    resizeObserver.observe(scrollContainer);

    // Also listen to window resize
    const handleResize = () => requestAnimationFrame(updateIndicatorPositions);
    window.addEventListener('resize', handleResize);

    return () => {
      scrollContainer.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
      observer.disconnect();
      resizeObserver.disconnect();
    };
  }, [calculatePositions, updateIndicatorPositions, scrollContainerRef, getScrollParent]);

  // Update positions when positions array changes
  useEffect(() => {
    requestAnimationFrame(updateIndicatorPositions);
  }, [positions, updateIndicatorPositions]);

  if (positions.length === 0) return null;

  return (
    <div ref={containerRef} className="fixed w-4 pointer-events-none z-50" style={{ top: 0, left: 0, height: '100%' }}>
      <TooltipProvider>
        {positions.map(pos => (
          <Tooltip key={pos.bookmark.id}>
            <TooltipTrigger asChild>
              <button
                ref={el => {
                  if (el) indicatorRefs.current.set(pos.bookmark.id, el);
                  else indicatorRefs.current.delete(pos.bookmark.id);
                }}
                type="button"
                onClick={() => scrollToBookmark(pos.bookmark)}
                className={cn(
                  'absolute w-3 h-3 rounded-sm cursor-pointer pointer-events-auto hover:scale-150 shadow-md',
                  colorClasses[pos.bookmark.color],
                )}
                aria-label={`Scroll to bookmark: ${pos.bookmark.title || 'Untitled'}`}
              />
            </TooltipTrigger>
            <TooltipContent side="left">{pos.bookmark.title || 'Untitled bookmark'}</TooltipContent>
          </Tooltip>
        ))}
      </TooltipProvider>
    </div>
  );
}
