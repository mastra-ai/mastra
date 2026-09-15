import { PanelSeparator } from '@mastra/playground-ui/resize/separator';
import { useEffect, useState } from 'react';
import type { RefObject } from 'react';

export function WorkflowPanelSeparator({
  surface,
  containerRef,
  label,
}: {
  surface: HTMLElement | null;
  containerRef: RefObject<HTMLDivElement | null>;
  label: string;
}) {
  const [bounds, setBounds] = useState({ top: 0, height: 0, offset: 0 });

  useEffect(() => {
    const container = containerRef.current;
    if (!surface || !container) return;
    const observer = new ResizeObserver(() => {
      const surfaceBounds = surface.getBoundingClientRect();
      const containerBounds = container.getBoundingClientRect();
      setBounds({
        top: surfaceBounds.top - containerBounds.top,
        height: surfaceBounds.height,
        offset: surfaceBounds.right - containerBounds.right,
      });
    });
    observer.observe(surface);
    observer.observe(container);
    return () => observer.disconnect();
  }, [surface, containerRef]);

  const isSurfaceVisible = Boolean(surface && bounds.height > 0);

  return (
    <PanelSeparator
      // Resizable panels caches separator targets at mount.
      key={isSurfaceVisible ? 'visible' : 'hidden'}
      aria-label={label}
      className="workflow-panel-separator"
      disabled={!isSurfaceVisible}
      style={{ top: bounds.top, height: bounds.height, transform: `translateX(${bounds.offset}px)` }}
    />
  );
}
