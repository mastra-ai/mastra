import type { DraggableProvidedDragHandleProps } from '@hello-pangea/dnd';
import type { BuilderLayer } from '../types';
import { LayerHeader } from './layer-header';
import { StepLayerBody } from './step-layer-body';
import { ParallelLayerBody } from './parallel-layer-body';
import { ConditionalLayerBody } from './conditional-layer-body';

interface ProcessorGraphLayerProps {
  layer: BuilderLayer;
  dragHandleProps: DraggableProvidedDragHandleProps | null | undefined;
}

export function ProcessorGraphLayer({ layer, dragHandleProps }: ProcessorGraphLayerProps) {
  return (
    <div className="rounded-md border border-border1 bg-surface2 overflow-hidden">
      <LayerHeader layer={layer} dragHandleProps={dragHandleProps} />
      <div className="p-3">
        {layer.entry.type === 'step' && <StepLayerBody layer={layer} />}
        {layer.entry.type === 'parallel' && <ParallelLayerBody layer={layer} />}
        {layer.entry.type === 'conditional' && <ConditionalLayerBody layer={layer} />}
      </div>
    </div>
  );
}
