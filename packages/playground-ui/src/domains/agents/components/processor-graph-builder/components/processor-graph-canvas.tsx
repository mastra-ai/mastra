import { Droppable, Draggable } from '@hello-pangea/dnd';
import { Layers, Plus } from 'lucide-react';
import { ScrollArea } from '@/ds/components/ScrollArea';
import { EmptyState } from '@/ds/components/EmptyState';
import { Button } from '@/ds/components/Button';
import { DropdownMenu } from '@/ds/components/DropdownMenu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ds/components/Select';
import { useProcessorGraphBuilderContext } from './processor-graph-builder-context';
import { ProcessorGraphLayer } from './processor-graph-layer';
import { LayerConnector } from './layer-connector';
import type { BuilderLayerType } from '../types';

export function ProcessorGraphCanvas() {
  const { builder, readOnly, variablesSchema } = useProcessorGraphBuilderContext();
  const { state, addLayer } = builder;
  const hasVariables = Object.keys(variablesSchema?.properties ?? {}).length > 0;

  if (state.layers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <EmptyState
          iconSlot={<Layers className="h-10 w-10 text-neutral3" />}
          titleSlot="No layers yet"
          descriptionSlot="Add a layer to start building your processor pipeline"
          actionSlot={
            !readOnly ? (
              <Select onValueChange={value => addLayer(value as BuilderLayerType)}>
                <SelectTrigger size="sm">
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  <SelectValue placeholder="Add layer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="step">Step</SelectItem>
                  <SelectItem value="parallel">Parallel</SelectItem>
                  {hasVariables && <SelectItem value="conditional">Conditional</SelectItem>}
                </SelectContent>
              </Select>
            ) : undefined
          }
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {!readOnly && (
        <div className="px-4 pt-4">
          <DropdownMenu>
            <DropdownMenu.Trigger asChild>
              <Button variant="outline">
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Add layer
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content>
              <DropdownMenu.Item onSelect={() => addLayer('step')}>Step</DropdownMenu.Item>
              <DropdownMenu.Item onSelect={() => addLayer('parallel')}>Parallel</DropdownMenu.Item>
              {hasVariables && (
                <DropdownMenu.Item onSelect={() => addLayer('conditional')}>Conditional</DropdownMenu.Item>
              )}
            </DropdownMenu.Content>
          </DropdownMenu>
        </div>
      )}

      <ScrollArea className="flex-1 min-h-0">
        <Droppable droppableId="layer-list" type="LAYER">
          {provided => (
            <div ref={provided.innerRef} {...provided.droppableProps} className="flex flex-col gap-1 p-4">
              {state.layers.map((layer, index) => (
                <div key={layer.id}>
                  {index > 0 && <LayerConnector />}
                  <Draggable draggableId={`layer-${layer.id}`} index={index} isDragDisabled={readOnly}>
                    {dragProvided => (
                      <div
                        ref={dragProvided.innerRef}
                        {...dragProvided.draggableProps}
                        style={dragProvided.draggableProps.style}
                      >
                        <ProcessorGraphLayer layer={layer} dragHandleProps={dragProvided.dragHandleProps} />
                      </div>
                    )}
                  </Draggable>
                </div>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </ScrollArea>
    </div>
  );
}
