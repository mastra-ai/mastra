import { Droppable } from '@hello-pangea/dnd';
import type { BuilderLayer } from '../types';
import { ProcessorStepCard } from './processor-step-card';
import { EmptySlot } from './empty-slot';

interface StepLayerBodyProps {
  layer: BuilderLayer;
}

export function StepLayerBody({ layer }: StepLayerBodyProps) {
  if (layer.entry.type !== 'step') return null;
  const { step } = layer.entry;
  const hasProvider = !!step.providerId;

  return (
    <Droppable droppableId={`layer-${layer.id}-slot`} type="PROVIDER">
      {(provided, snapshot) => (
        <div ref={provided.innerRef} {...provided.droppableProps}>
          {hasProvider ? (
            <ProcessorStepCard layerId={layer.id} step={step} />
          ) : (
            <EmptySlot isDraggingOver={snapshot.isDraggingOver} />
          )}
          <div className="hidden">{provided.placeholder}</div>
        </div>
      )}
    </Droppable>
  );
}
