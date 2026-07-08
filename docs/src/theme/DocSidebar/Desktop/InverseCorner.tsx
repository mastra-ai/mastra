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
 * Arc goes from (1,i) to (i,1), then closes through the (0,0) corner.
 * Straight edges overshoot by `o` to bleed over the parent's border.
 */
const O = 0.05
const I = 0.03
const FILL_PATH = `M ${1 + O} ${I} A 1 1 0 0 0 ${I} ${1 + O} L ${-O} ${1 + O} L ${-O} ${-O} L ${1 + O} ${-O} Z`

/**
 * Arc-only path for stroke rendering. Endpoints are inset by `I` so the arc
 * doesn't start flush at the edge, creating a smoother transition into the
 * parent's straight border.
 */
const ARC_PATH = `M 1 ${I} A 1 1 0 0 0 ${I} 1`

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
