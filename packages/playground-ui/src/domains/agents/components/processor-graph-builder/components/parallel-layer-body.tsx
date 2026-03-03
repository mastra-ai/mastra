import { Droppable } from '@hello-pangea/dnd';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/ds/components/Button';
import { IconButton } from '@/ds/components/IconButton';
import { Txt } from '@/ds/components/Txt';
import { useProcessorGraphBuilderContext } from './processor-graph-builder-context';
import type { ProcessorGraphEntryDepth2 } from '@mastra/core/storage';
import type { BuilderLayer } from '../types';
import { ProcessorStepCard } from './processor-step-card';
import { EmptySlot } from './empty-slot';

interface ParallelLayerBodyProps {
  layer: BuilderLayer;
}

export function ParallelLayerBody({ layer }: ParallelLayerBodyProps) {
  const { builder, readOnly } = useProcessorGraphBuilderContext();
  if (layer.entry.type !== 'parallel') return null;

  const { branches } = layer.entry;

  return (
    <div className="flex flex-col gap-2">
      {!readOnly && (
        <Button variant="outline" size="sm" className="self-start" onClick={() => builder.addBranch(layer.id)}>
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Add branch
        </Button>
      )}

      <div className="flex flex-row gap-2 overflow-x-auto">
        {branches.map((branch: ProcessorGraphEntryDepth2[], branchIndex: number) => (
          <div
            key={branchIndex}
            className="flex flex-col gap-1 min-w-[200px] flex-1 rounded border border-border1 bg-surface1 p-2"
          >
            <div className="flex items-center justify-between px-1">
              <Txt as="span" variant="ui-xs" className="text-neutral3">
                Branch {branchIndex + 1}
              </Txt>
              {!readOnly && branches.length > 1 && (
                <IconButton
                  variant="ghost"
                  size="sm"
                  tooltip="Remove branch"
                  onClick={() => builder.removeBranch(layer.id, branchIndex)}
                >
                  <Trash2 className="h-3 w-3" />
                </IconButton>
              )}
            </div>
            <Droppable droppableId={`layer-${layer.id}-branch-${branchIndex}`} type="PROVIDER">
              {(provided, snapshot) => (
                <div ref={provided.innerRef} {...provided.droppableProps} className="flex flex-col gap-1 min-h-[60px]">
                  {branch.map((entry, stepIndex) => {
                    if (entry.type !== 'step') return null;
                    return (
                      <ProcessorStepCard
                        key={`${layer.id}-branch-${branchIndex}-step-${stepIndex}`}
                        layerId={layer.id}
                        step={entry.step}
                        branchIndex={branchIndex}
                        stepIndex={stepIndex}
                      />
                    );
                  })}
                  {branch.length === 0 && <EmptySlot isDraggingOver={snapshot.isDraggingOver} />}
                  <div className="hidden">{provided.placeholder}</div>
                </div>
              )}
            </Droppable>
          </div>
        ))}
      </div>
    </div>
  );
}
