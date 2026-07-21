import { buildSankeyChartGraph, getSankeyChartNodeWeights } from '@mastra/playground-ui/components/SankeyChart';
import type { SankeyChartColumn, SankeyChartRecord } from '@mastra/playground-ui/components/SankeyChart';

import type { ThemeFlowResponse, ThemeNode, TraceSignalName } from './types';

export interface SignalGraphNodeSummary {
  nodeId: string;
  label: string;
  traceCount: number;
  stageShare: number;
}

export interface SignalGraphStageSummary {
  signalName: TraceSignalName;
  traceCount: number;
  nodes: SignalGraphNodeSummary[];
}

export function getSignalRecordNodeId(record: SankeyChartRecord, column: SankeyChartColumn) {
  return String(record[column.id]);
}

export function getSignalRecordNodeLabel(record: SankeyChartRecord, column: SankeyChartColumn) {
  return String(record[`${column.id}Label`]);
}

export function themeFlowToSankeyData(flow: ThemeFlowResponse): {
  columns: SankeyChartColumn[];
  records: SankeyChartRecord[];
} {
  const columns = flow.stages.map(stage => ({
    id: stage.signalName,
    label: formatSignalName(stage.signalName),
  }));
  const nodes = new Map<string, { signalName: TraceSignalName; node: ThemeNode }>();

  for (const stage of flow.stages) {
    for (const node of stage.nodes) nodes.set(node.nodeId, { signalName: stage.signalName, node });
  }

  const records: SankeyChartRecord[] = [];
  for (const link of flow.links) {
    const source = nodes.get(link.sourceNodeId);
    const target = nodes.get(link.targetNodeId);
    if (!source || !target) continue;

    records.push({
      [source.signalName]: source.node.nodeId,
      [`${source.signalName}Label`]: source.node.label,
      [target.signalName]: target.node.nodeId,
      [`${target.signalName}Label`]: target.node.label,
      traceCount: link.traceCount,
    });
  }

  return { columns, records };
}

export function buildSignalGraphSummary(flow: ThemeFlowResponse): {
  columns: SankeyChartColumn[];
  records: SankeyChartRecord[];
  analyzedTraceCount: number;
  stages: SignalGraphStageSummary[];
} {
  const { columns, records } = themeFlowToSankeyData(flow);
  const graph = buildSankeyChartGraph(
    records,
    columns,
    record => Number(record.traceCount),
    getSignalRecordNodeId,
    getSignalRecordNodeLabel,
  );
  const nodeWeights = getSankeyChartNodeWeights(graph);
  const firstColumnId = columns[0]?.id;
  const analyzedTraceCount = graph.nodes.reduce(
    (total, node) => (node.column.id === firstColumnId ? total + (nodeWeights.get(node.id) ?? 0) : total),
    0,
  );

  const stages = flow.stages.map(stage => {
    const graphNodes = new Map(
      graph.nodes.filter(node => node.column.id === stage.signalName).map(node => [String(node.value), node]),
    );
    const seenNodeIds = new Set<string>();
    const nodes = stage.nodes.flatMap(node => {
      const graphNode = graphNodes.get(node.nodeId);
      if (!graphNode || seenNodeIds.has(graphNode.id)) return [];
      seenNodeIds.add(graphNode.id);
      const traceCount = nodeWeights.get(graphNode.id) ?? 0;
      return [
        {
          nodeId: node.nodeId,
          label: node.label,
          traceCount,
          stageShare: analyzedTraceCount > 0 ? traceCount / analyzedTraceCount : 0,
        },
      ];
    });

    return {
      signalName: stage.signalName,
      traceCount: nodes.reduce((total, node) => total + node.traceCount, 0),
      nodes,
    };
  });

  return { columns, records, analyzedTraceCount, stages };
}

function formatSignalName(signalName: TraceSignalName) {
  return `${signalName.slice(0, 1).toUpperCase()}${signalName.slice(1)}`;
}
