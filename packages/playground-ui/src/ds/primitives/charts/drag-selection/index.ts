/**
 * Drag across a Recharts chart to select a range of points, e.g. to zoom into a time span.
 *
 * ```tsx
 * const selection = useDragSelection({ onSelect: ({ start, end }) => zoomTo(start, end) });
 *
 * <div className={selection.className}>
 *   <LineChart
 *     data={data}
 *     onMouseDown={selection.onMouseDown}
 *     onMouseMove={selection.onMouseMove}
 *     onClick={state => {
 *       if (selection.consumeReleaseClick()) return;
 *       // …a plain click on a point
 *     }}
 *   >
 *     {selection.enabled && <DragSelectionBand selection={selection} count={data.length} layout="point" />}
 *     <Line dataKey="value" />
 *   </LineChart>
 * </div>
 * ```
 */
export { DragSelectionBand, type DragSelectionBandProps } from './drag-selection-band';
export {
  activeIndex,
  orderedRange,
  selectionBandBox,
  type DragSelectionBox,
  type DragSelectionLayout,
  type DragSelectionRange,
} from './drag-selection-range';
export {
  DRAG_SELECTION_SURFACE_CLASS,
  useDragSelection,
  type DragSelection,
  type UseDragSelectionOptions,
} from './use-drag-selection';
