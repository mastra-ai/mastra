import type { DraggableProvidedDragHandleProps, DropResult, DroppableProvided } from '@hello-pangea/dnd';
import { DragDropContext, Draggable, Droppable, useMouseSensor, useTouchSensor } from '@hello-pangea/dnd';
import { Card, CardContent, CardHeader } from '@mastra/playground-ui/components/Card';
import { nodeColor } from '@mastra/playground-ui/components/SankeyChart';
import { getSignalHue } from '@mastra/playground-ui/ee/signals';
import { GripVertical } from 'lucide-react';

import type { ThemeSelection } from './theme-drilldown-data';
import type { ThemeFlowResponse, ThemeNode, TraceSignalName } from './types';

const DRAG_SENSORS = [useMouseSensor, useTouchSensor];

function formatSignalName(signalName: TraceSignalName) {
  return signalName.charAt(0).toUpperCase() + signalName.slice(1);
}

function traceLabel(count: number) {
  return `${count} ${count === 1 ? 'trace' : 'traces'}`;
}

function SignalDistributionRow({
  color,
  index,
  node,
  onViewThemeDetails,
  signalName,
}: {
  color: string;
  index: number;
  node: ThemeNode;
  onViewThemeDetails: (selection: ThemeSelection) => void;
  signalName: TraceSignalName;
}) {
  const content = (
    <>
      <span className="flex min-w-0 items-center gap-2 text-neutral5">
        <span
          aria-hidden="true"
          className="size-2 shrink-0 rounded-[2px]"
          style={{ backgroundColor: color, opacity: Math.max(0.35, 1 - index * 0.2) }}
        />
        <span className="truncate" title={node.label}>
          {node.label}
        </span>
      </span>
      <span className="shrink-0 font-mono text-neutral3">
        {node.traceCount} · {Math.round(node.stageShare * 100)}%
      </span>
    </>
  );

  if (node.kind === 'theme' && node.themeId && /^\d+$/.test(node.themeId)) {
    return (
      <li title={node.description ? `${node.label}\n${node.description}` : node.label}>
        <button
          aria-label={`View theme details for ${node.label}`}
          className="flex w-full min-w-0 items-center justify-between gap-3 rounded-xs text-left text-xs outline-hidden hover:bg-surface3 focus-visible:ring-1 focus-visible:ring-border2"
          onClick={() => onViewThemeDetails({ signalName, themeId: node.themeId, label: node.label })}
          type="button"
        >
          {content}
        </button>
      </li>
    );
  }

  return <li className="flex min-w-0 items-center justify-between gap-3 text-xs">{content}</li>;
}

function NoiseDistributionRow({
  color,
  signalName,
  traceCount,
  stageShare,
  onViewNoiseDetails,
}: {
  color: string;
  signalName: TraceSignalName;
  traceCount: number;
  stageShare: number;
  onViewNoiseDetails: (signalName: TraceSignalName) => void;
}) {
  const signalLabel = formatSignalName(signalName);

  return (
    <li>
      <button
        aria-label={`View Noise details for ${signalLabel}`}
        className="flex w-full min-w-0 items-center justify-between gap-3 rounded-xs text-left text-xs outline-hidden hover:bg-surface3 focus-visible:ring-1 focus-visible:ring-border2"
        onClick={() => onViewNoiseDetails(signalName)}
        type="button"
      >
        <span className="flex min-w-0 items-center gap-2 text-neutral5">
          <span aria-hidden="true" className="size-2 shrink-0 rounded-[2px]" style={{ backgroundColor: color }} />
          <span>Noise</span>
        </span>
        <span className="shrink-0 font-mono text-neutral3">
          {traceCount} · {Math.round(stageShare * 100)}%
        </span>
      </button>
    </li>
  );
}

function SignalDistribution({
  disabled,
  dragHandleProps,
  isDragging,
  signalName,
  traceCount,
  nodes,
  onViewThemeDetails,
  onViewNoiseDetails,
}: {
  disabled: boolean;
  dragHandleProps?: DraggableProvidedDragHandleProps;
  isDragging: boolean;
  signalName: TraceSignalName;
  traceCount: number;
  nodes: ThemeNode[];
  onViewThemeDetails: (selection: ThemeSelection) => void;
  onViewNoiseDetails: (signalName: TraceSignalName) => void;
}) {
  const label = formatSignalName(signalName);
  const color = nodeColor(getSignalHue(signalName));
  const displayNodes = nodes.filter(node => node.kind !== 'noise');
  const noiseNode = nodes.find(node => node.kind === 'noise');

  const cardClassName = isDragging ? 'min-w-0 shadow-lg ring-2 ring-accent1' : 'min-w-0 transition-shadow duration-150';

  return (
    <Card aria-label={`${label} distribution`} as="article" className={cardClassName} elevation="elevated">
      <CardHeader className="flex flex-row items-center justify-between border-b border-border1 px-4 py-3">
        <h3 className="font-mono text-xs font-semibold tracking-wider" style={{ color }}>
          {label.toUpperCase()}
        </h3>
        <div className="flex items-center gap-2">
          <div
            {...dragHandleProps}
            aria-disabled={disabled}
            aria-label={`Reorder ${label}`}
            className="cursor-grab rounded-xs p-1 text-neutral3 group-hover:text-neutral5 active:cursor-grabbing aria-disabled:cursor-wait aria-disabled:opacity-50"
            title={`Drag the ${label} card to reorder`}
          >
            <GripVertical aria-hidden="true" className="size-4" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-4">
        <p className="font-mono text-[10px] tracking-wider text-neutral3">{traceLabel(traceCount)}</p>
        <div
          aria-label={`${label} stacked distribution`}
          className="flex h-1.5 overflow-hidden rounded-xs bg-surface4"
          data-testid="distribution-stack"
        >
          {nodes.map((node, index) => (
            <span
              key={node.nodeId}
              aria-hidden="true"
              className="h-full"
              style={{
                backgroundColor: color,
                opacity: Math.max(0.35, 1 - index * 0.2),
                width: `${Math.min(node.stageShare * 100, 100)}%`,
              }}
            />
          ))}
        </div>
        <ul className="space-y-2.5">
          {displayNodes.length > 0 ? (
            displayNodes.map((node, index) => (
              <SignalDistributionRow
                key={node.nodeId}
                color={color}
                index={index}
                node={node}
                onViewThemeDetails={onViewThemeDetails}
                signalName={signalName}
              />
            ))
          ) : (
            <li className="text-xs text-neutral3">No themes detected</li>
          )}
          <NoiseDistributionRow
            color={color}
            signalName={signalName}
            traceCount={noiseNode?.traceCount ?? 0}
            stageShare={noiseNode?.stageShare ?? 0}
            onViewNoiseDetails={onViewNoiseDetails}
          />
        </ul>
      </CardContent>
    </Card>
  );
}

export function SignalDistributions({
  disabled = false,
  stages,
  onOrderChange,
  onViewThemeDetails,
  onViewNoiseDetails,
}: {
  disabled?: boolean;
  stages: ThemeFlowResponse['stages'];
  onOrderChange: (signalNames: TraceSignalName[]) => void;
  onViewThemeDetails: (selection: ThemeSelection) => void;
  onViewNoiseDetails: (signalName: TraceSignalName) => void;
}) {
  const handleDragEnd = (result: DropResult) => {
    const destinationIndex = result.destination?.index;
    if (destinationIndex === undefined || destinationIndex === result.source.index) return;

    const reorderedStages = [...stages];
    const [movedStage] = reorderedStages.splice(result.source.index, 1);
    if (!movedStage) return;
    reorderedStages.splice(destinationIndex, 0, movedStage);
    onOrderChange(reorderedStages.map(stage => stage.signalName));
  };

  return (
    <DragDropContext enableDefaultSensors={false} sensors={DRAG_SENSORS} onDragEnd={handleDragEnd}>
      <Droppable direction="horizontal" droppableId="signal-distributions">
        {(provided: DroppableProvided) => (
          <section
            {...provided.droppableProps}
            ref={provided.innerRef}
            aria-label="Signal distributions"
            className="flex gap-3 overflow-x-auto pb-1"
          >
            {stages.map((stage, index) => (
              <Draggable key={stage.signalName} draggableId={stage.signalName} index={index} isDragDisabled={disabled}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    className="min-w-56 flex-1 basis-0"
                    style={provided.draggableProps.style}
                  >
                    <SignalDistribution
                      disabled={disabled}
                      dragHandleProps={provided.dragHandleProps ?? undefined}
                      isDragging={snapshot.isDragging}
                      signalName={stage.signalName}
                      traceCount={stage.traceCount}
                      nodes={stage.nodes}
                      onViewThemeDetails={onViewThemeDetails}
                      onViewNoiseDetails={onViewNoiseDetails}
                    />
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </section>
        )}
      </Droppable>
    </DragDropContext>
  );
}
