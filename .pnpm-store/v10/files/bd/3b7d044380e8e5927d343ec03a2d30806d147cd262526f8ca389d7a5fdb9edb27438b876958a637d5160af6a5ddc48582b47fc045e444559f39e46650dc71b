import type { ImpactLocation, DroppableId, DragImpact } from '../../types';

export default (impact: DragImpact): DroppableId | null => {
  const at: ImpactLocation | null = impact.at;

  if (!at) {
    return null;
  }

  if (at.type === 'REORDER') {
    return at.destination.droppableId;
  }

  return at.combine.droppableId;
};
