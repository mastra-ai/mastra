import type { DraggableId, ContextId } from '../../types';
import * as attributes from '../data-attributes';
import { querySelectorAll } from '../../query-selector-all';
import { warning } from '../../dev-warning';
import isHtmlElement from '../is-type-of-element/is-html-element';

export default function findDraggable(
  contextId: ContextId,
  draggableId: DraggableId,
): HTMLElement | null {
  // cannot create a selector with the draggable id as it might not be a valid attribute selector
  const selector = `[${attributes.draggable.contextId}="${contextId}"]`;
  const possible = querySelectorAll(document, selector);

  const draggable = possible.find((el): boolean => {
    return el.getAttribute(attributes.draggable.id) === draggableId;
  });

  if (!draggable) {
    return null;
  }

  if (!isHtmlElement(draggable)) {
    warning('Draggable element is not a HTMLElement');
    return null;
  }

  return draggable;
}
