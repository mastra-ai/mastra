import { Card, CardContent, CardHeader } from '@mastra/playground-ui/components/Card';
import { nodeColor } from '@mastra/playground-ui/components/SankeyChart';
import { getSignalHue } from '@mastra/playground-ui/ee/signals';
import { GripVertical } from 'lucide-react';
import type { DragEvent } from 'react';
import { useState } from 'react';

import type { ThemeSelection } from './theme-drilldown-data';
import type { ThemeFlowResponse, ThemeNode, TraceSignalName } from './types';

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
  signalName,
  traceCount,
  nodes,
  onDragStart,
  onDragEnd,
  onViewThemeDetails,
  onViewNoiseDetails,
}: {
  disabled: boolean;
  signalName: TraceSignalName;
  traceCount: number;
  nodes: ThemeNode[];
  onDragStart: (event: DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
  onViewThemeDetails: (selection: ThemeSelection) => void;
  onViewNoiseDetails: (signalName: TraceSignalName) => void;
}) {
  const label = formatSignalName(signalName);
  const color = nodeColor(getSignalHue(signalName));
  const displayNodes = nodes.filter(node => node.kind !== 'noise');
  const noiseNode = nodes.find(node => node.kind === 'noise');

  return (
    <Card aria-label={`${label} distribution`} as="article" className="min-w-0" elevation="elevated">
      <CardHeader className="flex flex-row items-center justify-between border-b border-border1 px-4 py-3">
        <h3 className="font-mono text-xs font-semibold tracking-wider" style={{ color }}>
          {label.toUpperCase()}
        </h3>
        <div
          aria-disabled={disabled}
          aria-label={`Reorder ${label}`}
          className="cursor-grab rounded-xs p-1 text-neutral3 hover:bg-surface3 hover:text-neutral5 active:cursor-grabbing aria-disabled:cursor-wait aria-disabled:opacity-50"
          draggable={!disabled}
          onDragEnd={onDragEnd}
          onDragStart={onDragStart}
          title={`Drag to reorder ${label}`}
        >
          <GripVertical aria-hidden="true" className="size-4" />
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
  const [draggedSignalName, setDraggedSignalName] = useState<TraceSignalName>();
  const [dropTargetSignalName, setDropTargetSignalName] = useState<TraceSignalName>();
  const clearDragState = () => {
    setDraggedSignalName(undefined);
    setDropTargetSignalName(undefined);
  };
  const handleDrop = (targetSignalName: TraceSignalName) => {
    if (!draggedSignalName || draggedSignalName === targetSignalName) {
      clearDragState();
      return;
    }

    const reorderedStages = [...stages];
    const sourceIndex = reorderedStages.findIndex(stage => stage.signalName === draggedSignalName);
    const targetIndex = reorderedStages.findIndex(stage => stage.signalName === targetSignalName);
    if (sourceIndex < 0 || targetIndex < 0) {
      clearDragState();
      return;
    }
    const [movedStage] = reorderedStages.splice(sourceIndex, 1);
    if (!movedStage) {
      clearDragState();
      return;
    }
    reorderedStages.splice(targetIndex, 0, movedStage);
    clearDragState();
    onOrderChange(reorderedStages.map(stage => stage.signalName));
  };

  return (
    <section aria-label="Signal distributions" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {stages.map(stage => (
        <div
          key={stage.signalName}
          className={dropTargetSignalName === stage.signalName ? 'rounded-lg ring-2 ring-accent1' : undefined}
          onDragEnter={() => {
            if (draggedSignalName && draggedSignalName !== stage.signalName) {
              setDropTargetSignalName(stage.signalName);
            }
          }}
          onDragOver={event => {
            if (!draggedSignalName || draggedSignalName === stage.signalName) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = 'move';
          }}
          onDrop={event => {
            event.preventDefault();
            handleDrop(stage.signalName);
          }}
        >
          <SignalDistribution
            disabled={disabled}
            signalName={stage.signalName}
            traceCount={stage.traceCount}
            nodes={stage.nodes}
            onDragStart={event => {
              event.dataTransfer.effectAllowed = 'move';
              event.dataTransfer.setData('text/plain', stage.signalName);
              setDraggedSignalName(stage.signalName);
            }}
            onDragEnd={clearDragState}
            onViewThemeDetails={onViewThemeDetails}
            onViewNoiseDetails={onViewNoiseDetails}
          />
        </div>
      ))}
    </section>
  );
}
