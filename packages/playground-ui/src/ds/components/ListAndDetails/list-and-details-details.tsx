'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '../Button';

export type ListAndDetailsDetailsProps = {
  children?: React.ReactNode;
  numOfColumns?: number;
};

export function ListAndDetailsDetails({ children, numOfColumns = 1 }: ListAndDetailsDetailsProps): React.JSX.Element {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 1);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 1);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    updateScrollState();

    el.addEventListener('scroll', updateScrollState, { passive: true });

    const observer = new ResizeObserver(updateScrollState);
    observer.observe(el);

    return () => {
      el.removeEventListener('scroll', updateScrollState);
      observer.disconnect();
    };
  }, [updateScrollState]);

  const prevColumnsRef = useRef(numOfColumns);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (numOfColumns > prevColumnsRef.current) {
      // New column added — scroll to the right end so it's visible
      requestAnimationFrame(() => {
        el.scrollTo({ left: el.scrollWidth, behavior: 'smooth' });
      });
    }
    prevColumnsRef.current = numOfColumns;
  }, [numOfColumns]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        scrollToColumn(e.key === 'ArrowLeft' ? 'left' : 'right');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const scrollToColumn = (direction: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;

    const columns = Array.from(el.children) as HTMLElement[];
    const containerLeft = el.scrollLeft;
    const containerRight = containerLeft + el.clientWidth;

    if (direction === 'right') {
      // Find the first column whose right edge is past the container's right edge
      const target = columns.find(col => col.offsetLeft + col.offsetWidth > containerRight + 1);
      if (target) {
        el.scrollTo({ left: target.offsetLeft + target.offsetWidth - el.clientWidth, behavior: 'smooth' });
      }
    } else {
      // Find the last column whose left edge is before the container's left edge
      const target = [...columns].reverse().find(col => col.offsetLeft < containerLeft - 1);
      if (target) {
        el.scrollTo({ left: target.offsetLeft, behavior: 'smooth' });
      }
    }
  };

  return (
    <div className={cn('DETAILS relative w-full h-full overflow-hidden')}>
      {canScrollLeft && <ScrollArrow direction="left" onClick={() => scrollToColumn('left')} />}
      {canScrollRight && <ScrollArrow direction="right" onClick={() => scrollToColumn('right')} />}
      <div
        ref={scrollRef}
        className="grid overflow-x-auto w-full overflow-y-auto h-full"
        style={{
          gridTemplateColumns: `repeat(${numOfColumns}, 1fr)`,
        }}
      >
        {children}
      </div>
    </div>
  );
}

function ScrollArrow({ direction, onClick }: { direction: 'left' | 'right'; onClick: () => void }) {
  const Icon = direction === 'left' ? ChevronLeftIcon : ChevronRightIcon;
  const isLeft = direction === 'left';

  return (
    <div
      className={cn(
        'absolute top-0 bottom-0 z-10 w-20 flex items-center justify-center px-5 bg-surface2',
        isLeft ? 'left-0' : 'right-0',
      )}
    >
      <Button
        onClick={onClick}
        variant="standard"
        size="large"
        className="w-full h-full px-0"
        aria-label={`Scroll ${direction}`}
      >
        <Icon />
      </Button>
    </div>
  );
}
