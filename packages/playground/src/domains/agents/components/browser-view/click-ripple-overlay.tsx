import type { Ripple } from '../../hooks/use-click-ripple';

interface ClickRippleOverlayProps {
  ripples: Ripple[];
  onAnimationEnd: (id: number) => void;
}

/** Diameter of the ripple circle in CSS pixels */
const RIPPLE_SIZE = 32;
/** Radius offset to center the ripple on the click point */
const RIPPLE_RADIUS = RIPPLE_SIZE / 2;

/**
 * Renders absolutely-positioned ripple circles for click feedback.
 *
 * Each ripple is a span with the animate-click-ripple CSS animation
 * (scale 0->1, opacity 0.5->0 over 300ms). Ripples are removed from
 * state via onAnimationEnd when the animation completes.
 *
 * All spans have pointer-events-none to avoid intercepting mouse events.
 */
export function ClickRippleOverlay({ ripples, onAnimationEnd }: ClickRippleOverlayProps) {
  if (ripples.length === 0) return null;

  return (
    <>
      {ripples.map(ripple => (
        <span
          key={ripple.id}
          className="absolute rounded-full pointer-events-none animate-click-ripple bg-accent1/40"
          style={{
            left: ripple.x - RIPPLE_RADIUS,
            top: ripple.y - RIPPLE_RADIUS,
            width: RIPPLE_SIZE,
            height: RIPPLE_SIZE,
          }}
          onAnimationEnd={() => onAnimationEnd(ripple.id)}
        />
      ))}
    </>
  );
}
