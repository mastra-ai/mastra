import type { DragStart, DragUpdate, DraggableStateSnapshot, DropResult, DroppableProvided } from '@hello-pangea/dnd';
import {
  DragDropContext,
  Draggable,
  Droppable,
  useKeyboardSensor,
  useMouseSensor,
  useTouchSensor,
} from '@hello-pangea/dnd';
import { GripVertical } from 'lucide-react';
import { useState } from 'react';

import { getSignalHue } from './signal-colors';
import { signalDescription, signalLabel } from './signal-formatting';
import type { TraceSignalName } from './types';
import { useTraceIntelligence } from './use-trace-intelligence';
import { nodeColor } from '@/ds/components/SankeyChart';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ds/components/Tooltip';

const DRAG_SENSORS = [useMouseSensor, useTouchSensor, useKeyboardSensor];

type DragProjection = {
  sourceIndex: number;
  destinationIndex: number;
};

type HeaderAnchor = 'start' | 'middle' | 'end';

function projectedHeaderIndex(index: number, projection: DragProjection | undefined) {
  if (!projection) return index;
  if (index === projection.sourceIndex) return projection.destinationIndex;
  if (
    projection.sourceIndex < projection.destinationIndex &&
    index > projection.sourceIndex &&
    index <= projection.destinationIndex
  ) {
    return index - 1;
  }
  if (
    projection.destinationIndex < projection.sourceIndex &&
    index >= projection.destinationIndex &&
    index < projection.sourceIndex
  ) {
    return index + 1;
  }
  return index;
}

function headerAnchor(index: number, count: number): HeaderAnchor {
  if (index === 0) return 'start';
  if (index === count - 1) return 'end';
  return 'middle';
}

function contentOffsetClass(anchor: HeaderAnchor) {
  if (anchor === 'start') return 'translate-x-1/2';
  if (anchor === 'end') return '-translate-x-1/2';
  return '';
}

export function SortableSignalHeaders({
  signalNames,
  reorderDisabled,
  onOrderChange,
}: {
  signalNames: TraceSignalName[];
  reorderDisabled: boolean;
  onOrderChange: (signalNames: TraceSignalName[]) => void;
}) {
  const { signalCatalog } = useTraceIntelligence();
  const [dragProjection, setDragProjection] = useState<DragProjection>();

  function handleDragStart(start: DragStart) {
    setDragProjection({ sourceIndex: start.source.index, destinationIndex: start.source.index });
  }

  function handleDragUpdate(update: DragUpdate) {
    setDragProjection({
      sourceIndex: update.source.index,
      destinationIndex: update.destination?.index ?? update.source.index,
    });
  }

  function handleDragEnd(result: DropResult) {
    setDragProjection(undefined);
    const destinationIndex = result.destination?.index;
    if (destinationIndex === undefined || destinationIndex === result.source.index) return;

    const reordered = [...signalNames];
    const [movedSignalName] = reordered.splice(result.source.index, 1);
    if (!movedSignalName) return;
    reordered.splice(destinationIndex, 0, movedSignalName);
    onOrderChange(reordered);
  }

  return (
    <div aria-label="Signals" role="group">
      <DragDropContext
        enableDefaultSensors={false}
        sensors={DRAG_SENSORS}
        onDragEnd={handleDragEnd}
        onDragStart={handleDragStart}
        onDragUpdate={handleDragUpdate}
      >
        <Droppable direction="horizontal" droppableId="signal-column-headers">
          {(provided: DroppableProvided) => (
            <div
              {...provided.droppableProps}
              ref={provided.innerRef}
              aria-label="Trace signal column headers"
              className="flex items-center gap-1 px-8 pb-1"
              role="group"
            >
              {signalNames.map((signalName, index) => {
                const label = signalLabel(signalCatalog, signalName);
                const projectedIndex = projectedHeaderIndex(index, dragProjection);
                const offsetPercent =
                  signalNames.length > 1 ? (projectedIndex / (signalNames.length - 1) - 0.5) * 100 : 0;
                const anchor = headerAnchor(projectedIndex, signalNames.length);
                return (
                  <Draggable key={signalName} draggableId={signalName} index={index} isDragDisabled={reorderDisabled}>
                    {(dragProvided, dragSnapshot: DraggableStateSnapshot) => (
                      <div
                        ref={dragProvided.innerRef}
                        {...dragProvided.draggableProps}
                        className="flex min-w-0 flex-1 basis-0 items-center justify-center py-1"
                        data-dragging={dragSnapshot.isDragging}
                        style={dragProvided.draggableProps.style}
                      >
                        <div
                          className="flex w-full justify-center"
                          data-testid="signal-column-header-alignment"
                          style={{ translate: `${offsetPercent}%` }}
                        >
                          <div
                            className={`relative inline-flex items-center justify-center rounded-md border border-transparent px-1 py-0.5 motion-safe:transition-[background-color,border-color,box-shadow,scale] motion-safe:duration-150 ${contentOffsetClass(anchor)} ${
                              dragSnapshot.isDragging ? 'scale-1.03 border-border2 bg-surface4 shadow-lg' : ''
                            }`}
                            data-header-anchor={anchor}
                            data-testid="signal-column-header-content"
                          >
                            <Tooltip>
                              <TooltipTrigger
                                className="cursor-default font-mono text-xs font-semibold tracking-wider"
                                data-testid="signal-column-header"
                                style={{ color: nodeColor(getSignalHue(signalName)) }}
                              >
                                {label.toUpperCase()}
                              </TooltipTrigger>
                              <TooltipContent>{signalDescription(signalCatalog, signalName)}</TooltipContent>
                            </Tooltip>
                            <div
                              {...dragProvided.dragHandleProps}
                              aria-disabled={reorderDisabled}
                              aria-label={`Reorder ${label}`}
                              className="text-neutral3 hover:text-neutral5 absolute top-1/2 ml-0.5 -translate-y-1/2 cursor-grab rounded-sm p-1 active:cursor-grabbing aria-disabled:cursor-wait aria-disabled:opacity-50"
                              style={{ left: '100%' }}
                              title={`Drag to reorder the ${label} column`}
                            >
                              <GripVertical aria-hidden="true" className="size-3.5" />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </Draggable>
                );
              })}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    </div>
  );
}
