/**
 * The one recipe for a surface that floats above the canvas — app frame, card,
 * popover, dropdown, dialog, floating panel, tooltip.
 *
 * `--shadow-raised` carries the rim as well as the elevation (a 1px ring plus,
 * in dark, a top inset highlight), so a raised surface never draws a border of
 * its own: adding `border` on top of this doubles the edge.
 *
 * Radius is deliberately absent — it belongs to the family (`rounded-xl` for a
 * popup, `rounded-studio-frame` for the app frame).
 */
export const raisedSurfaceStyle = 'bg-card shadow-raised';
