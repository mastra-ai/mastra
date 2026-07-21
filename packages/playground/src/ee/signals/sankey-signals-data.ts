import type { SankeyChartColumn, SankeyChartRecord } from '@mastra/playground-ui/components/SankeyChart';

import type { ThemeFlowResponse, ThemeNode, TraceSignalName } from './types';

export function getSignalRecordNodeId(record: SankeyChartRecord, column: SankeyChartColumn) {
  return String(record[column.id]);
}

export function getSignalRecordNodeLabel(record: SankeyChartRecord, column: SankeyChartColumn) {
  const label = String(record[`${column.id}Label`]);
  const description = record[`${column.id}Description`];
  return typeof description === 'string' && description.trim() ? `${label}\n${description}` : label;
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
      [target.signalName]: target.node.nodeId,
      [`${target.signalName}Label`]: target.node.label,
      [`${target.signalName}Description`]: target.node.description,
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

function formatSignalName(signalName: TraceSignalName) {
  return `${signalName.slice(0, 1).toUpperCase()}${signalName.slice(1)}`;
}
