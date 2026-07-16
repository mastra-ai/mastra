import type { SankeyChartColumn, SankeyChartRecord } from '@mastra/playground-ui/components/SankeyChart';

import type { ThemeFlowResponse, ThemeNode, TraceSignalName } from './types';

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

    for (let index = 0; index < link.traceCount; index += 1) {
      records.push({
        [source.signalName]: source.node.label,
        [target.signalName]: target.node.label,
      });
    }
  }

  return { columns, records };
}

function formatSignalName(signalName: TraceSignalName) {
  return `${signalName.slice(0, 1).toUpperCase()}${signalName.slice(1)}`;
}
