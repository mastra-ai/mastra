import type { DragImpact, DraggableLocation, Combine } from '../types';

export function tryGetDestination(
  impact: DragImpact,
): DraggableLocation | null {
  if (impact.at && impact.at.type === 'REORDER') {
    return impact.at.destination;
  }
  return null;
}

export function tryGetCombine(impact: DragImpact): Combine | null {
  if (impact.at && impact.at.type === 'COMBINE') {
    return impact.at.combine;
  }
  return null;
}
