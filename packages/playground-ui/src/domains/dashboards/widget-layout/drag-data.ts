/** The drag data a widget carries: its id. An id the layout doesn't hold yet is a new widget. */
export const WIDGET_DRAG_TYPE = 'application/x-mastra-widget';

/** Lets anything outside the layout (a widget picker, a toolbox) be dragged in as a new widget. */
export function setWidgetDragData(dataTransfer: DataTransfer, widgetId: string) {
  dataTransfer.setData(WIDGET_DRAG_TYPE, widgetId);
  dataTransfer.effectAllowed = 'move';
}
