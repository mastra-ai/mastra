import { useCallback, useEffect, useRef, useState } from 'react';

export interface Ripple {
  id: number;
  x: number; // CSS px relative to container
  y: number; // CSS px relative to container
}

interface UseClickRippleOptions {
  imgRef: React.RefObject<HTMLImageElement | null>;
  viewport: { width: number; height: number } | null;
  enabled: boolean;
}

interface UseClickRippleReturn {
  ripples: Ripple[];
  removeRipple: (id: number) => void;
}

/** Safety cap to prevent unbounded ripple state growth */
const MAX_RIPPLES = 10;

/**
 * Manages click ripple visual feedback for the browser view frame.
 *
 * Creates a ripple at the mousedown position in display-space CSS pixels
 * (container-relative), providing instant visual confirmation before the
 * remote browser frame updates (100-300ms latency).
 *
 * Only fires on left-click (button === 0) inside the rendered image area,
 * ignoring letterbox/pillarbox dead zones.
 */
export function useClickRipple(options: UseClickRippleOptions): UseClickRippleReturn {
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const idRef = useRef(0);

  // Store viewport in ref to avoid listener re-attachment (same pattern as use-mouse-interaction.ts)
  const viewportRef = useRef(options.viewport);
  useEffect(() => {
    viewportRef.current = options.viewport;
  }, [options.viewport]);

  const removeRipple = useCallback((id: number) => {
    setRipples(prev => prev.filter(r => r.id !== id));
  }, []);

  useEffect(() => {
    if (!options.enabled || !options.imgRef.current) {
      return;
    }

    const imgElement = options.imgRef.current;

    function handleMouseDown(e: MouseEvent): void {
      // Left-click only
      if (e.button !== 0) return;

      const viewport = viewportRef.current;
      if (!viewport) return;

      const rect = imgElement.getBoundingClientRect();

      // Position relative to the <img> element (container-relative CSS px)
      const relX = e.clientX - rect.left;
      const relY = e.clientY - rect.top;

      // Letterbox boundary check using same math as coordinate-mapping.ts
      const scale = Math.min(rect.width / viewport.width, rect.height / viewport.height);
      const renderedWidth = viewport.width * scale;
      const renderedHeight = viewport.height * scale;
      const offsetX = (rect.width - renderedWidth) / 2;
      const offsetY = (rect.height - renderedHeight) / 2;

      const imageX = relX - offsetX;
      const imageY = relY - offsetY;

      // Reject clicks in letterbox/pillarbox dead zone
      if (imageX < 0 || imageY < 0 || imageX > renderedWidth || imageY > renderedHeight) {
        return;
      }

      // Use container-relative display coordinates for ripple positioning
      setRipples(prev => {
        if (prev.length >= MAX_RIPPLES) return prev;
        const id = ++idRef.current;
        return [...prev, { id, x: relX, y: relY }];
      });
    }

    imgElement.addEventListener('mousedown', handleMouseDown);

    return () => {
      imgElement.removeEventListener('mousedown', handleMouseDown);
    };
  }, [options.enabled, options.imgRef]);

  return { ripples, removeRipple };
}
