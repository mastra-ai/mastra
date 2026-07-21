import type { ThemeFlowResponse, ThemeNode, ThemePathsResponse, TraceSignalName } from './types';

export type ThemeSelection = {
  signalName: TraceSignalName;
  themeId: string;
  label: string;
};

export function findThemeSelection(
  flow: ThemeFlowResponse,
  signalName: string,
  nodeId: string | number,
): ThemeSelection | undefined {
  const stage = flow.stages.find(candidate => candidate.signalName === signalName);
  if (!stage) return undefined;
  const node = stage.nodes.find(candidate => candidate.nodeId === String(nodeId));
  if (node?.kind !== 'theme' || !node.themeId || !/^\d+$/.test(node.themeId)) return undefined;
  return { signalName: stage.signalName, themeId: node.themeId, label: node.label };
}

export function buildDrilledThemeFlow(
  flow: ThemeFlowResponse,
  pathsResponse: ThemePathsResponse,
  selection: ThemeSelection,
): ThemeFlowResponse {
  const selectedNodeKey = Object.entries(pathsResponse.themes).find(
    ([, theme]) => theme.signalName === selection.signalName && theme.themeId === selection.themeId,
  )?.[0];
  const filteredPaths = selectedNodeKey
    ? pathsResponse.paths.filter(path => path.assignments[selection.signalName] === selectedNodeKey)
    : [];
  const flowNodesBySignalAndTheme = new Map<TraceSignalName, Map<string, ThemeNode>>();
  const noiseNodeIds = new Map<TraceSignalName, string>();

  for (const stage of flow.stages) {
    const themes = new Map<string, ThemeNode>();
    for (const node of stage.nodes) {
      if (node.kind === 'theme' && node.themeId) themes.set(node.themeId, node);
      if (node.kind === 'noise') noiseNodeIds.set(stage.signalName, node.nodeId);
    }
    flowNodesBySignalAndTheme.set(stage.signalName, themes);
  }

  let localThemeIndex = 0;
  const nodesBySignalAndAssignment = new Map<TraceSignalName, Map<string, ThemeNode>>();
  const nodeCounts = new Map<string, number>();
  const links = new Map<
    string,
    { sourceNodeId: string; targetNodeId: string; traceCount: number; sourceShare: number; targetShare: number }
  >();

  const resolveNode = (signalName: TraceSignalName, assignment: string) => {
    const nodesByAssignment = nodesBySignalAndAssignment.get(signalName) ?? new Map<string, ThemeNode>();
    nodesBySignalAndAssignment.set(signalName, nodesByAssignment);
    const existingNode = nodesByAssignment.get(assignment);
    if (existingNode) return existingNode;

    const theme = pathsResponse.themes[assignment];
    const flowNode = theme ? flowNodesBySignalAndTheme.get(signalName)?.get(theme.themeId) : undefined;
    const node: ThemeNode = theme
      ? {
          nodeId: flowNode?.nodeId ?? `drilled-theme-${localThemeIndex++}`,
          kind: 'theme',
          themeId: theme.themeId,
          label: theme.label,
          description: theme.description,
          traceCount: 0,
          stageShare: 0,
        }
      : {
          nodeId: noiseNodeIds.get(signalName) ?? `drilled-noise-${signalName}`,
          kind: 'noise',
          label: 'Noise',
          traceCount: 0,
          stageShare: 0,
        };
    nodesByAssignment.set(assignment, node);
    return node;
  };

  for (const path of filteredPaths) {
    for (let index = 0; index < pathsResponse.signals.length; index += 1) {
      const signalName = pathsResponse.signals[index];
      if (!signalName) continue;
      const assignment = path.assignments[signalName];
      if (!assignment) continue;
      const node = resolveNode(signalName, assignment);
      nodeCounts.set(node.nodeId, (nodeCounts.get(node.nodeId) ?? 0) + 1);

      const targetSignalName = pathsResponse.signals[index + 1];
      if (!targetSignalName) continue;
      const targetAssignment = path.assignments[targetSignalName];
      if (!targetAssignment) continue;
      const targetNode = resolveNode(targetSignalName, targetAssignment);
      const linkId = JSON.stringify([node.nodeId, targetNode.nodeId]);
      const link = links.get(linkId);
      if (link) {
        link.traceCount += 1;
      } else {
        links.set(linkId, {
          sourceNodeId: node.nodeId,
          targetNodeId: targetNode.nodeId,
          traceCount: 1,
          sourceShare: 0,
          targetShare: 0,
        });
      }
    }
  }

  const stages = pathsResponse.signals.map(signalName => {
    const traceCount = filteredPaths.filter(path => path.assignments[signalName] !== undefined).length;
    const uniqueNodes = new Map<string, ThemeNode>();
    for (const node of nodesBySignalAndAssignment.get(signalName)?.values() ?? []) uniqueNodes.set(node.nodeId, node);
    const nodes = [...uniqueNodes.values()].map(node => {
      const count = nodeCounts.get(node.nodeId) ?? 0;
      return { ...node, traceCount: count, stageShare: traceCount > 0 ? count / traceCount : 0 };
    });
    return { signalName, traceCount, nodes };
  });

  const countsByNodeId = new Map(stages.flatMap(stage => stage.nodes.map(node => [node.nodeId, node.traceCount])));
  const drilledLinks = [...links.values()].map(link => ({
    ...link,
    sourceShare: link.traceCount / (countsByNodeId.get(link.sourceNodeId) ?? link.traceCount),
    targetShare: link.traceCount / (countsByNodeId.get(link.targetNodeId) ?? link.traceCount),
  }));

  return {
    snapshot: { ...pathsResponse.snapshot, traceCount: filteredPaths.length },
    stages,
    links: drilledLinks,
  };
}
