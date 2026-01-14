import clsx from 'clsx';
import React, { useRef, useState, useEffect, useCallback } from 'react';

const INDICATOR_WIDTH = 40;
const INDICATOR_HEIGHT = 150;
const INDICATOR_SPACE = 10;

export type ScrollableContainerProps = {
  className?: string;
  children: React.ReactNode;
  scrollSpeed?: number; // Optional prop to set scroll speed (pixels per interval)
  scrollIntervalTime?: number; // Optional prop to set scroll interval time (ms)
};

export const ScrollableContainer = ({
  className,
  children,
  scrollSpeed = 100,
  scrollIntervalTime = 20,
}: ScrollableContainerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const [containerHeight, setContainerHeight] = useState(0);
  const [containerRight, setContainerRight] = useState(0);
  const [containerTop, setContainerTop] = useState(0);
  const [containerLeft, setContainerLeft] = useState(0);
  const [showRightIndicator, setShowRightIndicator] = useState(false);
  const [showLeftIndicator, setShowLeftIndicator] = useState(false);

  useEffect(() => {
    const updatePositions = () => {
      if (!containerRef.current) return;

      // Update container dimensions
      const canScrollRight =
        containerRef.current.scrollLeft < containerRef.current.scrollWidth - containerRef.current.clientWidth;
      setShowRightIndicator(canScrollRight);
      setContainerHeight(containerRef.current.clientHeight);

      // Calculate container's edges relative to viewport
      const rect = containerRef.current.getBoundingClientRect();
      setContainerRight(rect.right);
      setContainerLeft(rect.left);
      setContainerTop(rect.top);
    };

    // Initial update
    updatePositions();

    // Observe resize
    const resizeObserver = new ResizeObserver(updatePositions);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    // Handle scroll
    const handleScroll = () => {
      if (!containerRef.current) return;

      // Check if we can scroll in either direction
      const canScrollLeft = containerRef.current.scrollLeft > 0;
      const canScrollRight =
        containerRef.current.scrollLeft < containerRef.current.scrollWidth - containerRef.current.clientWidth;

      // Update indicator states
      setShowLeftIndicator(canScrollLeft);
      setShowRightIndicator(canScrollRight);

      // Update positions
      updatePositions();
    };

    // Add scroll listener
    containerRef?.current?.addEventListener('scroll', handleScroll);

    const container = containerRef.current;

    return () => {
      if (container) {
        resizeObserver.unobserve(container);
        container.removeEventListener('scroll', handleScroll);
      }
    };
  }, []);

  const ScrollIndicator = ({
    isVisible,
    position,
    containerHeight,
    containerTop,
    containerRight,
    onStartScrolling,
    onStopScrolling,
  }: {
    isVisible: boolean;
    position: 'left' | 'right';
    containerHeight: number;
    containerTop: number;
    containerRight: number;
    onStartScrolling: (e: React.MouseEvent | React.TouchEvent) => void;
    onStopScrolling: () => void;
  }) => {
    if (!isVisible) return null;

    const styles = {
      top: containerHeight < INDICATOR_HEIGHT ? containerTop : containerTop + (containerHeight - INDICATOR_HEIGHT) / 2,
      width: INDICATOR_WIDTH,
      height: containerHeight < INDICATOR_HEIGHT ? `${containerHeight}px` : `${INDICATOR_HEIGHT}px`,
    } as const;

    return (
      <button
        onMouseDown={onStartScrolling}
        onTouchStart={onStartScrolling}
        onMouseUp={onStopScrolling}
        onTouchEnd={onStopScrolling}
        onTouchCancel={onStopScrolling}
        className="bg-surface4 text-muted-foreground border-surface5 hover:border-muted-foreground fixed z-10 flex items-center justify-center rounded-lg border text-2xl hover:text-white"
        style={{
          ...styles,
          left:
            position === 'left' ? containerLeft + INDICATOR_SPACE : containerRight - INDICATOR_WIDTH - INDICATOR_SPACE,
        }}
      >
        {' '}
        {position === 'left' ? '«' : '»'}
      </button>
    );
  };

  const startScrolling = useCallback(
    (direction: 'left' | 'right', e?: React.MouseEvent | React.TouchEvent) => {
      // Prevent default to avoid any text selection or other default behaviors
      e?.preventDefault();
      e?.stopPropagation();

      // Clear any existing interval to prevent duplicates
      if (scrollInterval.current) {
        clearInterval(scrollInterval.current);
        scrollInterval.current = null;
      }

      // Initial scroll to handle the first click immediately
      if (containerRef.current) {
        containerRef.current.scrollBy({
          left: direction === 'right' ? scrollSpeed * 2 : -scrollSpeed * 2,
          behavior: 'smooth',
        });
      }

      // Then start the interval for continuous scrolling
      scrollInterval.current = setInterval(() => {
        if (containerRef.current) {
          containerRef.current.scrollBy({
            left: direction === 'right' ? scrollSpeed : -scrollSpeed,
            behavior: 'smooth',
          });
        }
      }, scrollIntervalTime);
    },
    [scrollSpeed, scrollIntervalTime],
  );

  const stopScrolling = useCallback(() => {
    if (scrollInterval.current) {
      clearInterval(scrollInterval.current);
      scrollInterval.current = null;
    }
  }, []);

  return (
    <div ref={containerRef} className={clsx('relative max-h-full overflow-auto', className)}>
      {children}
      <ScrollIndicator
        isVisible={showLeftIndicator}
        position="left"
        containerHeight={containerHeight}
        containerTop={containerTop}
        containerRight={containerRight}
        onStartScrolling={e => startScrolling('left', e)}
        onStopScrolling={stopScrolling}
      />
      <ScrollIndicator
        isVisible={showRightIndicator}
        position="right"
        containerHeight={containerHeight}
        containerTop={containerTop}
        containerRight={containerRight}
        onStartScrolling={e => startScrolling('right', e)}
        onStopScrolling={stopScrolling}
      />
    </div>
  );
};
