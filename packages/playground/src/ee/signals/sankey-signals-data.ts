import type { SankeyChartColumn, SankeyChartRecord } from '@mastra/playground-ui/components/SankeyChart';

import type { ThemeFlowResponse, ThemeNode, TraceSignalName } from './types';

const MINIMUM_LAYOUT_WEIGHT = 0.01;

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
      [`${source.signalName}Description`]: source.node.description,
      [`${source.signalName}TraceCount`]: source.node.traceCount,
      [target.signalName]: target.node.nodeId,
      [`${target.signalName}Label`]: target.node.label,
      [`${target.signalName}Description`]: target.node.description,
      [`${target.signalName}TraceCount`]: target.node.traceCount,
      traceCount: link.traceCount,
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

export function stabilizeThemeFlow(flow: ThemeFlowResponse, windowFlows: ThemeFlowResponse[]): ThemeFlowResponse {
  const stages = flow.stages.map(stage => {
    const nodes = new Map<string, ThemeNode>();

    for (const windowFlow of windowFlows) {
      const windowStage = windowFlow.stages.find(candidate => candidate.signalName === stage.signalName);
      for (const node of windowStage?.nodes ?? []) {
        nodes.set(node.nodeId, { ...node, traceCount: 0, stageShare: 0 });
      }
    }
    for (const node of stage.nodes) nodes.set(node.nodeId, node);

    return { ...stage, nodes: [...nodes.values()] };
  });

  const links = new Map<string, Map<string, ThemeFlowResponse['links'][number]>>();
  for (const windowFlow of windowFlows) {
    for (const link of windowFlow.links) {
      const targets = links.get(link.sourceNodeId) ?? new Map();
      const existing = targets.get(link.targetNodeId);
      if (!existing || link.traceCount > existing.traceCount) {
        targets.set(link.targetNodeId, {
          ...link,
          traceCount: Math.max(MINIMUM_LAYOUT_WEIGHT, link.traceCount),
        });
      }
      links.set(link.sourceNodeId, targets);
    }
  }

  return { ...flow, stages, links: [...links.values()].flatMap(targets => [...targets.values()]) };
}

function formatSignalName(signalName: TraceSignalName) {
  return `${signalName.slice(0, 1).toUpperCase()}${signalName.slice(1)}`;
}
