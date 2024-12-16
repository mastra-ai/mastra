'use client';

import { MouseEventHandler, RefObject, useCallback, useEffect, useState } from 'react';

interface useBackgroundCanvasScrollProps {
  containerRef: RefObject<HTMLDivElement | null>;
  includeVerticalScroll?: boolean;
}

export function useBackgroundCanvasScroll({ containerRef, includeVerticalScroll }: useBackgroundCanvasScrollProps) {
  const [position, setPosition] = useState({ left: 0, x: 0, top: 0, y: 0 });

  const handleMouseMove = useCallback<(ev: MouseEvent) => void>(
    (ev: MouseEvent) => {
      if (containerRef.current) {
        const dx = ev.clientX - position.x;
        containerRef.current.scrollLeft = position.left - dx;

        if (includeVerticalScroll) {
          const dy = ev.clientY - position.y;
          containerRef.current.scrollTop = position.top - dy;
        }
      }
    },
    [position, containerRef, includeVerticalScroll],
  );

  const handleMouseUp = useCallback(() => {
    if (containerRef.current) {
      containerRef.current.removeEventListener('mousemove', handleMouseMove);
      containerRef.current.removeEventListener('mouseup', handleMouseUp);
      containerRef.current.style.cursor = 'default';
    }
  }, [handleMouseMove, containerRef]);

  const handleMouseDown = useCallback<MouseEventHandler<HTMLDivElement>>(
    event => {
      if (containerRef.current) {
        const newPos = {
          left: containerRef.current.scrollLeft,
          x: event.clientX,
          top: containerRef.current.scrollTop,
          y: event.clientY,
        };
        setPosition(newPos);
        containerRef.current.style.cursor = 'grabbing';
        containerRef.current.style.userSelect = 'none';
      }
    },
    [containerRef],
  );

  useEffect(() => {
    if (position.x && containerRef.current) {
      containerRef.current.addEventListener('mousemove', handleMouseMove);
      containerRef.current.addEventListener('mouseup', handleMouseUp);
    }
  }, [position, handleMouseMove, handleMouseUp, containerRef]);

  return { handleMouseDown, handleMouseUp };
}
