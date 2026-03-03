import { useCallback } from 'react';
import { v4 as uuid } from '@lukeed/uuid';
import type { DropResult } from '@hello-pangea/dnd';
import type { ProcessorProviderInfo } from '@mastra/client-js';

import type { ProcessorGraphBuilderAPI } from './use-processor-graph-builder';
import type { ProcessorPhase } from '../types';

export function useProcessorGraphDnd(builder: ProcessorGraphBuilderAPI, providers: ProcessorProviderInfo[]) {
  const onDragEnd = useCallback(
    (result: DropResult) => {
      const { source, destination, draggableId } = result;
      if (!destination) return;

      // Layer reorder: both source and destination are 'layer-list'
      if (source.droppableId === 'layer-list' && destination.droppableId === 'layer-list') {
        builder.reorderLayers(source.index, destination.index);
        return;
      }

      // Provider dropped onto a slot
      if (source.droppableId === 'provider-list' && destination.droppableId.startsWith('layer-')) {
        const providerId = draggableId.replace('provider-', '');
        const provider = providers.find(p => p.id === providerId);
        if (!provider) return;

        const step = {
          id: uuid(),
          providerId: provider.id,
          config: {},
          enabledPhases: provider.availablePhases as ProcessorPhase[],
        };

        const destParts = destination.droppableId.split('-');

        // layer-{layerId}-slot -> step layer
        if (destParts.length >= 3 && destParts[destParts.length - 1] === 'slot') {
          const layerId = destParts.slice(1, -1).join('-');
          builder.setStep(layerId, step);
          return;
        }

        // layer-{layerId}-branch-{branchIndex} -> parallel branch
        const branchIdx = destParts.indexOf('branch');
        if (branchIdx !== -1) {
          const layerId = destParts.slice(1, branchIdx).join('-');
          const branchIndex = parseInt(destParts[branchIdx + 1]!, 10);
          builder.addStepToBranch(layerId, branchIndex, step);
          return;
        }

        // layer-{layerId}-cond-{condIndex} -> conditional branch
        const condIdx = destParts.indexOf('cond');
        if (condIdx !== -1) {
          const layerId = destParts.slice(1, condIdx).join('-');
          const conditionIndex = parseInt(destParts[condIdx + 1]!, 10);
          builder.addStepToCondition(layerId, conditionIndex, step);
          return;
        }
      }
    },
    [builder, providers],
  );

  return { onDragEnd };
}
