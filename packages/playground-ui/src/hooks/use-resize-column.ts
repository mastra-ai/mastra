import { MouseEvent as ReactMouseEvent, useContext, useEffect, useRef, useState } from 'react';

import { TraceContext } from '@/domains/traces/context/trace-context';

export const useResizeColumn = ({
  defaultWidth,
  minimumWidth,
  maximumWidth,
}: {
  defaultWidth: number;
  minimumWidth: number;
  maximumWidth: number;
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState<number>(defaultWidth);
  const { isOpen } = useContext(TraceContext);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStartXRef = useRef(0);
  const initialWidthRef = useRef(0);

  const handleMouseDown = (e: ReactMouseEvent) => {
    e.preventDefault(); // Prevent text selection
    setIsDragging(true);
    dragStartXRef.current = e.clientX;
    initialWidthRef.current = sidebarWidth;
  };

  useEffect(() => {
    if (!isOpen) {
      setSidebarWidth(defaultWidth);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return;

      const containerWidth = containerRef.current.offsetWidth;
      const deltaX = dragStartXRef.current - e.clientX;
      const deltaPercentage = (deltaX / containerWidth) * 100;

      // Calculate new width percentage
      const newWidth = Math.min(Math.max(initialWidthRef.current + deltaPercentage, minimumWidth), maximumWidth);
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  return { sidebarWidth, isDragging, handleMouseDown, containerRef };
};
