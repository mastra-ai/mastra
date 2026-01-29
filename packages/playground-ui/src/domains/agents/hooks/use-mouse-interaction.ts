import { useEffect, useRef } from 'react';
import { mapClientToViewport, normalizeWheelDelta, getModifiers } from '../utils/coordinate-mapping';

interface UseMouseInteractionOptions {
  imgRef: React.RefObject<HTMLImageElement | null>;
  viewport: { width: number; height: number } | null;
  sendMessage: (data: string) => void;
  enabled: boolean;
}

/**
 * Side-effect-only hook that attaches mouse, wheel, and context menu event
 * listeners to a browser screencast <img> element.
 *
 * Translates DOM mouse events into CDP input messages and sends them over
 * the WebSocket via sendMessage. Coordinates are mapped from the scaled
 * <img> display space to browser viewport CSS pixels using the pure
 * utilities in coordinate-mapping.ts.
 *
 * Features:
 * - Click (mousedown/mouseup) with CDP mouseMoved + mousePressed / mouseReleased sequence
 * - Right-click forwarding with host context menu suppression
 * - Wheel events normalized across browsers and deltaMode, clamped to 500
 * - Mouse move throttled to ~30fps via requestAnimationFrame
 * - Modifier keys (Alt, Ctrl, Meta, Shift) included as CDP bitmask
 * - Letterbox/pillarbox clicks silently ignored
 */
export function useMouseInteraction(options: UseMouseInteractionOptions): void {
  // Store in refs so event handlers always read current values
  // without causing listener re-attachment
  const viewportRef = useRef(options.viewport);
  const sendRef = useRef(options.sendMessage);

  useEffect(() => {
    viewportRef.current = options.viewport;
  }, [options.viewport]);

  useEffect(() => {
    sendRef.current = options.sendMessage;
  }, [options.sendMessage]);

  useEffect(() => {
    if (!options.enabled || !options.imgRef.current) {
      return;
    }

    const imgElement = options.imgRef.current;

    // --- Helper: send a CDP mouse input message ---
    function sendMouseEvent(
      eventType: 'mouseMoved' | 'mousePressed' | 'mouseReleased' | 'mouseWheel',
      x: number,
      y: number,
      button?: 'left' | 'right' | 'middle' | 'none',
      clickCount?: number,
      modifiers?: number,
      deltaX?: number,
      deltaY?: number,
    ): void {
      const msg: Record<string, unknown> = { type: 'mouse', eventType, x, y };
      if (button !== undefined) msg.button = button;
      if (clickCount !== undefined) msg.clickCount = clickCount;
      if (modifiers !== undefined) msg.modifiers = modifiers;
      if (deltaX !== undefined) msg.deltaX = deltaX;
      if (deltaY !== undefined) msg.deltaY = deltaY;
      sendRef.current(JSON.stringify(msg));
    }

    // --- Map DOM button index to CDP button name ---
    function mapButton(domButton: number): 'left' | 'right' | 'middle' {
      if (domButton === 2) return 'right';
      if (domButton === 1) return 'middle';
      return 'left';
    }

    // --- mousedown: CDP mouseMoved + mousePressed ---
    function handleMouseDown(e: MouseEvent): void {
      const viewport = viewportRef.current;
      if (!viewport) return;

      const rect = imgElement.getBoundingClientRect();
      const mapped = mapClientToViewport(e.clientX, e.clientY, rect, viewport);
      if (!mapped) return;

      const button = mapButton(e.button);
      const modifiers = getModifiers(e);

      sendMouseEvent('mouseMoved', mapped.x, mapped.y, undefined, undefined, modifiers);
      sendMouseEvent('mousePressed', mapped.x, mapped.y, button, 1, modifiers);
    }

    // --- mouseup: CDP mouseReleased ---
    function handleMouseUp(e: MouseEvent): void {
      const viewport = viewportRef.current;
      if (!viewport) return;

      const rect = imgElement.getBoundingClientRect();
      const mapped = mapClientToViewport(e.clientX, e.clientY, rect, viewport);
      if (!mapped) return;

      const button = mapButton(e.button);
      sendMouseEvent('mouseReleased', mapped.x, mapped.y, button, 1, getModifiers(e));
    }

    // --- contextmenu: suppress host context menu for right-click forwarding ---
    function handleContextMenu(e: MouseEvent): void {
      e.preventDefault();
    }

    // --- wheel: CDP mouseWheel with normalized deltas ---
    function handleWheel(e: WheelEvent): void {
      e.preventDefault();

      const viewport = viewportRef.current;
      if (!viewport) return;

      const rect = imgElement.getBoundingClientRect();
      const mapped = mapClientToViewport(e.clientX, e.clientY, rect, viewport);
      if (!mapped) return;

      const normDeltaX = normalizeWheelDelta(e.deltaX, e.deltaMode, viewport.height);
      const normDeltaY = normalizeWheelDelta(e.deltaY, e.deltaMode, viewport.height);

      sendMouseEvent('mouseWheel', mapped.x, mapped.y, undefined, undefined, getModifiers(e), normDeltaX, normDeltaY);
    }

    // --- mousemove: rAF-throttled CDP mouseMoved (~30fps) ---
    let rafId: number | null = null;
    let lastMoveTime = 0;
    let pendingMoveEvent: MouseEvent | null = null;
    const FRAME_INTERVAL = 1000 / 30; // ~33.33ms for 30fps cap

    function handleMouseMove(e: MouseEvent): void {
      pendingMoveEvent = e;

      if (rafId !== null) return; // already scheduled

      rafId = requestAnimationFrame((now: number) => {
        rafId = null;

        if (!pendingMoveEvent) return;

        const delta = now - lastMoveTime;
        if (delta < FRAME_INTERVAL) return;

        lastMoveTime = now;

        const viewport = viewportRef.current;
        if (!viewport) {
          pendingMoveEvent = null;
          return;
        }

        const rect = imgElement.getBoundingClientRect();
        const mapped = mapClientToViewport(pendingMoveEvent.clientX, pendingMoveEvent.clientY, rect, viewport);
        pendingMoveEvent = null;

        if (!mapped) return;

        sendMouseEvent('mouseMoved', mapped.x, mapped.y, undefined, undefined, getModifiers(e));
      });
    }

    // --- Attach event listeners ---
    imgElement.addEventListener('mousedown', handleMouseDown);
    imgElement.addEventListener('mouseup', handleMouseUp);
    imgElement.addEventListener('contextmenu', handleContextMenu);
    imgElement.addEventListener('wheel', handleWheel, { passive: false });
    imgElement.addEventListener('mousemove', handleMouseMove);

    // --- Cleanup ---
    return () => {
      imgElement.removeEventListener('mousedown', handleMouseDown);
      imgElement.removeEventListener('mouseup', handleMouseUp);
      imgElement.removeEventListener('contextmenu', handleContextMenu);
      imgElement.removeEventListener('wheel', handleWheel);
      imgElement.removeEventListener('mousemove', handleMouseMove);

      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [options.enabled, options.imgRef]);
}
