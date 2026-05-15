/**
 * Pure coordinate mapping, wheel normalization, and modifier key utilities
 * for the browser live view mouse interaction layer.
 *
 * All functions are pure (no DOM, no React, no side effects) and operate
 * on plain numeric inputs. They translate scaled <img> element coordinates
 * to browser viewport CSS pixel coordinates for CDP input injection.
 */

export interface ElementRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface ViewportDimensions {
  width: number;
  height: number;
}

export interface MappedCoordinates {
  x: number;
  y: number;
}

export interface ModifierKeys {
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
}

/** Approximate line height in pixels for deltaMode 1 (DOM_DELTA_LINE) */
const LINE_HEIGHT_PX = 16;

/** Maximum absolute delta per wheel event to prevent extreme scroll jumps */
const MAX_DELTA = 500;

/**
 * Map a client mouse position on a scaled <img> element to browser viewport
 * CSS pixel coordinates, accounting for object-fit: contain letterboxing.
 *
 * When the browser viewport aspect ratio differs from the <img> element's
 * aspect ratio, object-fit: contain centers the rendered image with black
 * bars (letterbox or pillarbox). This function computes the mapping from
 * display-space coordinates to viewport-space coordinates.
 *
 * Returns null if the click lands in the letterbox/pillarbox region.
 *
 * @param clientX - MouseEvent.clientX
 * @param clientY - MouseEvent.clientY
 * @param elemRect - Result of imgElement.getBoundingClientRect()
 * @param viewport - Browser viewport dimensions from ViewportMessage
 */
export function mapClientToViewport(
  clientX: number,
  clientY: number,
  elemRect: ElementRect,
  viewport: ViewportDimensions,
): MappedCoordinates | null {
  // Position relative to the <img> element
  const relX = clientX - elemRect.left;
  const relY = clientY - elemRect.top;

  // Scale factor used by object-fit: contain
  const scale = Math.min(elemRect.width / viewport.width, elemRect.height / viewport.height);

  // Rendered image dimensions within the element
  const renderedWidth = viewport.width * scale;
  const renderedHeight = viewport.height * scale;

  // Letterbox/pillarbox offsets (image is centered)
  const offsetX = (elemRect.width - renderedWidth) / 2;
  const offsetY = (elemRect.height - renderedHeight) / 2;

  // Position relative to the rendered image area
  const imageX = relX - offsetX;
  const imageY = relY - offsetY;

  // Reject clicks in the letterbox/pillarbox region
  if (imageX < 0 || imageY < 0 || imageX > renderedWidth || imageY > renderedHeight) {
    return null;
  }

  // Map to browser viewport coordinates
  return {
    x: imageX / scale,
    y: imageY / scale,
  };
}

/**
 * Normalize a WheelEvent delta value to CSS pixels.
 *
 * Handles cross-browser deltaMode differences:
 *   0 = DOM_DELTA_PIXEL (Chrome default)
 *   1 = DOM_DELTA_LINE (Firefox default on Windows/Linux)
 *   2 = DOM_DELTA_PAGE (rare, some trackpads)
 *
 * Result is clamped to [-500, 500] to prevent extreme scroll jumps.
 *
 * @param delta - WheelEvent.deltaX or WheelEvent.deltaY
 * @param deltaMode - WheelEvent.deltaMode (0, 1, or 2)
 * @param viewportHeight - Optional viewport height for page-mode conversion (defaults to 800)
 */
export function normalizeWheelDelta(delta: number, deltaMode: number, viewportHeight?: number): number {
  let pixels: number;

  switch (deltaMode) {
    case 0: // DOM_DELTA_PIXEL
      pixels = delta;
      break;
    case 1: // DOM_DELTA_LINE
      pixels = delta * LINE_HEIGHT_PX;
      break;
    case 2: // DOM_DELTA_PAGE
      pixels = delta * (viewportHeight ?? 800);
      break;
    default:
      pixels = delta;
  }

  return Math.max(-MAX_DELTA, Math.min(MAX_DELTA, pixels));
}

/**
 * Convert JavaScript modifier key flags to CDP modifier bitmask.
 *
 * CDP bitmask values: Alt=1, Ctrl=2, Meta/Command=4, Shift=8
 *
 * @param event - Object with modifier key boolean properties
 */
export function getModifiers(event: ModifierKeys): number {
  let modifiers = 0;
  if (event.altKey) modifiers |= 1;
  if (event.ctrlKey) modifiers |= 2;
  if (event.metaKey) modifiers |= 4;
  if (event.shiftKey) modifiers |= 8;
  return modifiers;
}
