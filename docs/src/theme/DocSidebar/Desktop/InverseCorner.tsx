import type { CSSProperties } from 'react'

export interface InverseCornerProps {
  /**
   * CSS value for the corner radius, e.g. "12px" or "var(--radius)".
   * Sets both width and height of the SVG.
   */
  size: string
  /**
   * Fill color — should match the parent's background.
   */
  fill?: string
  /**
   * Optional border/stroke color.
   */
  borderColor?: string
  /**
   * Border width in pixels.
   */
  borderWidth?: number
  className?: string
  style?: CSSProperties
}

/**
 * Fill path for a concave top-right corner in a 1×1 viewBox.
 *
 * The arc runs corner-to-corner, from the box's top-right (1,0) to its
 * bottom-left (0,1), then closes back through the (0,0) corner. The straight
 * edges overshoot by `O` so the fill bleeds over the parent's borders and
 * leaves no gap.
 */
const O = 0.1
const FILL_PATH = `M 1 0 A 1 1 0 0 0 0 1 L ${-O} 1 L ${-O} ${-O} L 1 ${-O} Z`

/**
 * Arc-only path for stroke rendering. The arc spans the full quarter circle,
 * from the top edge (1,0) to the left edge (0,1), so its endpoints land
 * exactly on the parent's navbar-bottom and sidebar-right borders. Position
 * the SVG so this stroke overlaps those borders (see the consumer).
 */
const ARC_PATH = `M 1 0 A 1 1 0 0 0 0 1`

/**
 * Renders an "inverse border-radius" — a concave quarter-circle at the
 * top-right that makes a div appear to extend outward with a smooth curve.
 *
 * Place this inside a `position: relative` parent. The SVG is absolutely
 * positioned above the parent's top-right edge, extending outward.
 */
export function InverseCorner({
  size,
  fill = 'currentColor',
  borderColor,
  borderWidth = 1,
  className,
  style,
}: InverseCornerProps) {
  return (
    <svg
      viewBox="0 0 1 1"
      preserveAspectRatio="none"
      aria-hidden="true"
      className={className}
      style={{
        position: 'absolute',
        display: 'block',
        pointerEvents: 'none',
        overflow: 'visible',
        bottom: '100%',
        right: 0,
        width: size,
        height: size,
        ...style,
      }}
    >
      <path d={FILL_PATH} fill={fill} stroke="none" />
      {borderColor && (
        <path
          d={ARC_PATH}
          fill="none"
          stroke={borderColor}
          strokeWidth={borderWidth}
          vectorEffect="non-scaling-stroke"
        />
      )}
    </svg>
  )
}
