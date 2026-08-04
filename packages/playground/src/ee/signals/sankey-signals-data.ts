import type { SankeyChartColumn, SankeyChartRecord } from '@mastra/playground-ui/components/SankeyChart';

import { formatSnapshotCutoff, formatSnapshotWindow, themeLabel, traceLabel } from './signal-formatting';
import type { ThemeFlowResponse, ThemeNode, ThemeSnapshot, TraceSignalName } from './types';

const MINIMUM_LAYOUT_WEIGHT = 0.01;

type StableThemeFlowLink = ThemeFlowResponse['links'][number] & { layoutTraceCount: number };
type StableThemeFlowResponse = Omit<ThemeFlowResponse, 'links'> & { links: StableThemeFlowLink[] };

export function getSignalRecordNodeId(record: SankeyChartRecord, column: SankeyChartColumn) {
  return String(record[column.id]);
}

export function getSignalRecordNodeLabel(record: SankeyChartRecord, column: SankeyChartColumn) {
  const label = String(record[`${column.id}Label`]);
  const description = record[`${column.id}Description`];
  return typeof description === 'string' && description.trim() ? `${label}\n${description}` : label;
}

export function getSignalRecordNodeValue(record: SankeyChartRecord, column: SankeyChartColumn) {
  return Number(record[`${column.id}TraceCount`]);
}

export function themeFlowToSankeyData(flow: ThemeFlowResponse): {
  columns: SankeyChartColumn[];
  records: SankeyChartRecord[];
} {
  const nodes = new Map<string, { signalName: TraceSignalName; node: ThemeNode }>();

  for (const stage of flow.stages) {
    for (const node of stage.nodes) nodes.set(node.nodeId, { signalName: stage.signalName, node });
  }

  // Only stages that participate in links become chart columns. A stage with
  // themes but no links (possible in real flows) would otherwise leave a
  // phantom first column: the chart lays out linked columns across the full
  // width but keeps anchoring labels as if the unlinked column still led.
  const linkedSignalNames = new Set(
    flow.links.flatMap(link => {
      const source = nodes.get(link.sourceNodeId);
      const target = nodes.get(link.targetNodeId);
      return [...(source ? [source.signalName] : []), ...(target ? [target.signalName] : [])];
    }),
  );
  const columns = flow.stages
    .filter(stage => linkedSignalNames.has(stage.signalName))
    .map(stage => ({
      id: stage.signalName,
      label: formatSignalName(stage.signalName),
    }));

  const records: SankeyChartRecord[] = [];
  for (const link of flow.links) {
    const source = nodes.get(link.sourceNodeId);
    const target = nodes.get(link.targetNodeId);
    if (!source || !target) continue;

    records.push({
      [source.signalName]: source.node.nodeId,
      [`${source.signalName}Label`]: displayNodeLabel(source.node),
      [`${source.signalName}Description`]: source.node.description,
      [`${source.signalName}TraceCount`]: source.node.traceCount,
      [target.signalName]: target.node.nodeId,
      [`${target.signalName}Label`]: displayNodeLabel(target.node),
      [`${target.signalName}Description`]: target.node.description,
      [`${target.signalName}TraceCount`]: target.node.traceCount,
      traceCount: link.traceCount,
      layoutTraceCount: 'layoutTraceCount' in link ? link.layoutTraceCount : link.traceCount,
    });
  }

  return { columns, records };
}

export function buildSignalGraphSummary(flow: ThemeFlowResponse): {
  columns: SankeyChartColumn[];
  records: SankeyChartRecord[];
} {
  return themeFlowToSankeyData(flow);
}

/**
 * Snapshot ids whose flows the timeline needs right now: the selected landmark
 * plus its previous and next playback neighbors (playback wraps around).
 */
export function selectFlowSnapshotIds(snapshots: Array<{ snapshotId: string }>, selectedIndex: number): string[] {
  if (snapshots.length === 0) return [];
  const neighborIndexes = new Set([
    (selectedIndex - 1 + snapshots.length) % snapshots.length,
    selectedIndex,
    (selectedIndex + 1) % snapshots.length,
  ]);
  return [...neighborIndexes]
    .sort((left, right) => left - right)
    .flatMap(index => {
      const snapshot = snapshots[index];
      return snapshot ? [snapshot.snapshotId] : [];
    });
}

/**
 * Keeps node ordering and ribbon layout widths consistent across the playback
 * window without inventing content: only nodes and links present in the
 * current snapshot render (no zero-count ghosts from neighboring flows), but
 * their order and layout weight come from the whole window so shared themes
 * hold their position while scrubbing.
 */
export function stabilizeThemeFlow(flow: ThemeFlowResponse, windowFlows: ThemeFlowResponse[]): StableThemeFlowResponse {
  const stages = flow.stages.map(stage => {
    const orderedNodeIds = new Map<string, number>();
    for (const windowFlow of windowFlows) {
      const windowStage = windowFlow.stages.find(candidate => candidate.signalName === stage.signalName);
      for (const node of windowStage?.nodes ?? []) {
        if (!orderedNodeIds.has(node.nodeId)) orderedNodeIds.set(node.nodeId, orderedNodeIds.size);
      }
    }

    const nodes = stage.nodes
      .filter(node => node.traceCount > 0)
      .sort(
        (left, right) =>
          (orderedNodeIds.get(left.nodeId) ?? Number.MAX_SAFE_INTEGER) -
          (orderedNodeIds.get(right.nodeId) ?? Number.MAX_SAFE_INTEGER),
      );
    return { ...stage, nodes };
  });

  const keptNodeIds = new Set(stages.flatMap(stage => stage.nodes.map(node => node.nodeId)));
  const layoutWeights = new Map<string, number>();
  const orderedLinkKeys = new Map<string, number>();
  for (const windowFlow of windowFlows) {
    for (const link of windowFlow.links) {
      const key = `${link.sourceNodeId}\u0000${link.targetNodeId}`;
      layoutWeights.set(key, Math.max(layoutWeights.get(key) ?? 0, link.traceCount));
      if (!orderedLinkKeys.has(key)) orderedLinkKeys.set(key, orderedLinkKeys.size);
    }
  }

  const stableLinks = flow.links
    .filter(link => link.traceCount > 0 && keptNodeIds.has(link.sourceNodeId) && keptNodeIds.has(link.targetNodeId))
    .sort((left, right) => {
      const leftKey = `${left.sourceNodeId}\u0000${left.targetNodeId}`;
      const rightKey = `${right.sourceNodeId}\u0000${right.targetNodeId}`;
      return (orderedLinkKeys.get(leftKey) ?? 0) - (orderedLinkKeys.get(rightKey) ?? 0);
    })
    .map((link): StableThemeFlowLink => {
      const key = `${link.sourceNodeId}\u0000${link.targetNodeId}`;
      return {
        ...link,
        layoutTraceCount: Math.max(MINIMUM_LAYOUT_WEIGHT, layoutWeights.get(key) ?? link.traceCount),
      };
    });

  return { ...flow, stages, links: stableLinks };
}

function displayNodeLabel(node: ThemeNode) {
  return node.kind === 'noise' ? 'Noise' : node.label;
}

function formatSignalName(signalName: TraceSignalName) {
  return `${signalName.slice(0, 1).toUpperCase()}${signalName.slice(1)}`;
}

/**
 * "Date · N traces · N themes" line rendered under the timeline in every view
 * mode. Counts come from the charted flow (cohort stage totals), so a drilled
 * flow reports the drilled subset; date-only while the flow is loading.
 */
export function snapshotSummaryLabel(snapshot: ThemeSnapshot, flow: ThemeFlowResponse | undefined) {
  const date = snapshot.cutoffAt
    ? formatSnapshotCutoff(snapshot.cutoffAt)
    : formatSnapshotWindow(snapshot.startedAt, snapshot.endedAt);
  if (!flow) return date;

  const traceCount = flow.stages[0]?.traceCount ?? flow.snapshot.traceCount;
  const themeCount = flow.stages.reduce(
    (total, stage) => total + stage.nodes.filter(node => node.kind === 'theme').length,
    0,
  );
  return `${date} · ${traceLabel(traceCount)} · ${themeLabel(themeCount)}`;
}
