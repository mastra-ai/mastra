import type { SankeyChartColumn, SankeyChartRecord } from '@mastra/playground-ui/components/SankeyChart';

import type { ThemeFlowResponse, ThemeNode, TraceSignalName } from './types';

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

export function stabilizeThemeFlow(flow: ThemeFlowResponse, windowFlows: ThemeFlowResponse[]): StableThemeFlowResponse {
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

  const layoutLinks = new Map<string, ThemeFlowResponse['links'][number]>();
  for (const windowFlow of windowFlows) {
    for (const link of windowFlow.links) {
      const key = `${link.sourceNodeId}\u0000${link.targetNodeId}`;
      const existing = layoutLinks.get(key);
      if (!existing || link.traceCount > existing.traceCount) layoutLinks.set(key, link);
    }
  }
  const currentLinks = new Map(flow.links.map(link => [`${link.sourceNodeId}\u0000${link.targetNodeId}`, link]));
  const stableLinks = [...layoutLinks.entries()].map(([key, layoutLink]): StableThemeFlowLink => {
    const currentLink = currentLinks.get(key);
    return {
      ...(currentLink ?? layoutLink),
      traceCount: currentLink?.traceCount ?? 0,
      sourceShare: currentLink?.sourceShare ?? 0,
      targetShare: currentLink?.targetShare ?? 0,
      layoutTraceCount: Math.max(MINIMUM_LAYOUT_WEIGHT, layoutLink.traceCount),
    };
  });

  return { ...flow, stages, links: stableLinks };
}

function formatSignalName(signalName: TraceSignalName) {
  return `${signalName.slice(0, 1).toUpperCase()}${signalName.slice(1)}`;
}
