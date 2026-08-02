import type { DropResult, DroppableProvided, DroppableStateSnapshot } from '@hello-pangea/dnd';
import { DragDropContext, Draggable, Droppable } from '@hello-pangea/dnd';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { GripVertical } from 'lucide-react';
import { createPortal } from 'react-dom';
import type { ColumnMapping, FieldType } from '../../hooks/use-column-mapping';

export interface ColumnMappingStepProps {
  headers: string[];
  mapping: ColumnMapping;
  onMappingChange: (column: string, field: FieldType) => void;
}

// Zone configuration for display
const ZONES: { id: FieldType; label: string; description: string; required?: boolean }[] = [
  { id: 'input', label: 'Input', description: 'Data passed to target', required: true },
  { id: 'groundTruth', label: 'Ground Truth', description: 'Ground truth for comparison' },
  { id: 'metadata', label: 'Metadata', description: 'Additional context' },
  { id: 'ignore', label: 'Ignore', description: 'Not imported' },
];

export function ColumnMappingStep({ headers, mapping, onMappingChange }: ColumnMappingStepProps) {
  // Handle drag end - move column to new zone
  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) {
      return;
    }

    const column = result.draggableId;
    const targetField = result.destination.droppableId as FieldType;

    // Only update if field changed
    if (mapping[column] !== targetField) {
      onMappingChange(column, targetField);
    }
  };

  // Get columns for a specific zone
  const getColumnsForZone = (zone: FieldType): string[] => {
    return headers.filter(header => mapping[header] === zone);
  };

  // Check if input zone has columns
  const inputHasColumns = getColumnsForZone('input').length > 0;

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="flex flex-col gap-4">
        <div className="text-neutral4 text-sm">Drag columns to assign them to dataset fields</div>

        {ZONES.map(zone => {
          const columnsInZone = getColumnsForZone(zone.id);
          const isEmpty = columnsInZone.length === 0;
          const needsAttention = zone.required && isEmpty;

          return (
            <div key={zone.id} className="flex flex-col gap-2">
              {/* Zone header */}
              <div className="flex items-center gap-2">
                <span className="text-neutral1 text-sm font-medium">{zone.label}</span>
                {zone.required && <span className="text-accent1 text-xs">*</span>}
                <span className="text-neutral4 text-xs">{zone.description}</span>
              </div>

              {/* Drop zone */}
              <Droppable droppableId={zone.id} direction="horizontal">
                {(provided: DroppableProvided, snapshot: DroppableStateSnapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`min-h-header-default flex flex-wrap items-center gap-2 rounded-lg border-2 border-dashed p-2 transition-colors ${snapshot.isDraggingOver ? 'border-accent1/50 bg-accent1/5' : 'border-surface4'} ${needsAttention ? 'border-warning bg-warning/5' : ''} `}
                  >
                    {isEmpty && !snapshot.isDraggingOver && (
                      <span className="text-neutral4 text-xs italic">
                        {needsAttention ? 'Drag at least one column here' : 'No columns assigned'}
                      </span>
                    )}

                    {columnsInZone.map((column, index) => (
                      <Draggable key={column} draggableId={column} index={index}>
                        {(provided, snapshot) => {
                          const child = (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              style={provided.draggableProps.style}
                              className={`bg-surface2 text-neutral1 inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-all ${snapshot.isDragging ? 'ring-accent1/30 shadow-lg ring-2' : 'hover:bg-surface3'} `}
                            >
                              <span
                                {...provided.dragHandleProps}
                                className="text-neutral4 cursor-grab active:cursor-grabbing"
                              >
                                <Icon>
                                  <GripVertical className="h-3.5 w-3.5" />
                                </Icon>
                              </span>
                              <span>{column}</span>
                            </div>
                          );

                          // Portal dragged item to document.body to avoid
                          // offset issues from Radix Dialog portal + scrollable container
                          if (snapshot.isDragging) {
                            return createPortal(child, document.body);
                          }

                          return child;
                        }}
                      </Draggable>
                    ))}

                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          );
        })}

        {/* Validation message */}
        {!inputHasColumns && <div className="text-warning text-sm">At least one column must be mapped to Input</div>}
      </div>
    </DragDropContext>
  );
}
