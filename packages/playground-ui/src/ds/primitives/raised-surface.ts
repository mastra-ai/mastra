/**
 * Two recipes, because elevation encodes distance from the canvas and there are
 * only two distances in this product.
 *
 * A *raised* surface sits in the flow — card, list panel, settings container,
 * table head, app frame. It lifts a couple of pixels, which is also what keeps
 * it honest: a tile in a grid inside a scroller is clipped by that scroller, so
 * a shadow that bleeds further than the tile's own clearance gets sliced into a
 * hard line along the container edge.
 *
 * An *overlay* is detached — popover, dropdown, dialog, drawer, tooltip. It is
 * never clipped, has to separate from arbitrary content beneath it, and so
 * carries the long falloff.
 *
 * Both tokens carry the rim as well as the elevation (the rim is `--border`
 * itself, plus a top inset highlight in dark), so neither draws a border of its
 * own: adding `border` on top doubles the edge.
 *
 * Radius is deliberately absent — it belongs to the family (`rounded-xl` for a
 * popup, `rounded-studio-frame` for the app frame).
 *
 * A raised surface pins its own fill across states. Interaction is expressed by
 * the state layer below, never by swapping the background: `Button`'s variants
 * all drive `background-color` on hover, and a raised surface wearing one would
 * otherwise turn translucent mid-hover and composite over the canvas. A call
 * site that genuinely wants another fill still overrides it, since its own
 * classes come after these.
 */
export const raisedSurfaceStyle = 'bg-card hover:bg-card active:bg-card shadow-raised';

export const overlaySurfaceStyle = 'bg-card shadow-overlay';

/**
 * The app frame and the panels docked beside it. Same elevation as a card, one
 * step lower fill: a frame is a hole cut in the rail, and what sits inside it —
 * cards, fields, tables — needs a step to rise above. `Card` is for that
 * content, never for the frame around it.
 */
export const frameSurfaceStyle = 'bg-background shadow-raised';

/**
 * Interaction states for a surface that already carries an opaque fill. The
 * `state-layer` utility in `src/index.css` holds the reasoning and the measured
 * numbers: the rung has to be layered, never swapped into `background-color`.
 */
export const surfaceStateLayerStyle = 'state-layer';

/**
 * Same layer, driven by an ancestor marked `group` rather than the surface
 * itself. A utility cannot read an ancestor's state, so this one stays composed
 * from variants — `isolate` and the negative z-index do the same job as the
 * utility's, and `inset-px` likewise keeps the inset rim visible.
 */
export const surfaceGroupStateLayerStyle =
  'relative isolate before:pointer-events-none before:absolute before:-z-1 before:inset-px before:rounded-[inherit] before:transition-colors before:duration-fast motion-reduce:before:transition-none group-hover:before:bg-fill-subtle group-focus-visible:before:bg-fill-subtle';
