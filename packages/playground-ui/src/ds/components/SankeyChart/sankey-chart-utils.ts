export type SankeyChartRecord = Record<string, unknown>;

export type SankeyChartColumn = {
  id: string;
  label: string;
};

export type SankeyChartNode = {
  id: string;
  name: string;
  column: SankeyChartColumn;
  value: string | number;
};

export type SankeyChartLink = {
  id: string;
  source: number;
  target: number;
  value: number;
  sourceNode: SankeyChartNode;
  targetNode: SankeyChartNode;
  records: Array<SankeyChartRecord>;
};

export type SankeyChartGraph = {
  nodes: Array<SankeyChartNode>;
  links: Array<SankeyChartLink>;
};

export type SankeyChartCurveSelection = {
  source: {
    column: SankeyChartColumn;
    value: string | number;
  };
  target: {
    column: SankeyChartColumn;
    value: string | number;
  };
  records: Array<SankeyChartRecord>;
};

const EMPTY_GRAPH: SankeyChartGraph = { nodes: [], links: [] };

// Approximate glyph width relative to font size. Node labels render in a mono
// font (~0.6) so we bias slightly higher to guard against under-truncating.
const SANKEY_LABEL_CHAR_WIDTH_RATIO = 0.62;
const SANKEY_LABEL_ELLIPSIS = '…';

export function estimateSankeyLabelWidth(text: string, fontSize: number): number {
  return text.length * fontSize * SANKEY_LABEL_CHAR_WIDTH_RATIO;
}

export function truncateSankeyLabel(
  text: string,
  fontSize: number,
  maxWidth: number,
): { text: string; truncated: boolean } {
  if (!Number.isFinite(maxWidth) || maxWidth <= 0) return { text, truncated: false };
  if (estimateSankeyLabelWidth(text, fontSize) <= maxWidth) return { text, truncated: false };

  const maxChars = Math.floor(maxWidth / (fontSize * SANKEY_LABEL_CHAR_WIDTH_RATIO));
  if (maxChars <= 1) return { text: SANKEY_LABEL_ELLIPSIS, truncated: true };

  return { text: `${text.slice(0, maxChars - 1).trimEnd()}${SANKEY_LABEL_ELLIPSIS}`, truncated: true };
}

export function getSankeyChartValue(value: unknown): string | number | undefined {
  if (typeof value === 'string') {
    const trimmedValue = value.trim();
    return trimmedValue.length > 0 ? trimmedValue : undefined;
  }

  if (typeof value === 'number' && Number.isFinite(value)) return value;

  return undefined;
}

export function reorderSankeyChartColumns(
  columns: Array<SankeyChartColumn>,
  startIndex: number,
  endIndex: number,
): Array<SankeyChartColumn> {
  if (
    startIndex === endIndex ||
    startIndex < 0 ||
    endIndex < 0 ||
    startIndex >= columns.length ||
    endIndex >= columns.length
  ) {
    return columns;
  }

  const reorderedColumns = [...columns];
  const [movedColumn] = reorderedColumns.splice(startIndex, 1);
  if (!movedColumn) return columns;
  reorderedColumns.splice(endIndex, 0, movedColumn);
  return reorderedColumns;
}

export function buildSankeyChartGraph(
  data: Array<SankeyChartRecord>,
  columns: Array<SankeyChartColumn>,
  getRecordWeight: (record: SankeyChartRecord) => number = () => 1,
): SankeyChartGraph {
  if (columns.length < 2 || data.length === 0) return EMPTY_GRAPH;

  const nodes: Array<SankeyChartNode> = [];
  const nodeIndexes = new Map<string, number>();
  const linksById = new Map<string, SankeyChartLink>();

  const getNode = (column: SankeyChartColumn, value: string | number): { node: SankeyChartNode; index: number } => {
    const id = createNodeId(column.id, value);
    const existingIndex = nodeIndexes.get(id);
    const existingNode = existingIndex === undefined ? undefined : nodes[existingIndex];
    if (existingIndex !== undefined && existingNode) return { node: existingNode, index: existingIndex };

    const node: SankeyChartNode = { id, name: String(value), column, value };
    const index = nodes.length;
    nodes.push(node);
    nodeIndexes.set(id, index);
    return { node, index };
  };

  for (let columnIndex = 0; columnIndex < columns.length - 1; columnIndex += 1) {
    const sourceColumn = columns[columnIndex];
    const targetColumn = columns[columnIndex + 1];
    if (!sourceColumn || !targetColumn) continue;

    for (const record of data) {
      const weight = getRecordWeight(record);
      if (!Number.isFinite(weight) || weight < 0) continue;

      const sourceValue = getSankeyChartValue(record[sourceColumn.id]);
      const targetValue = getSankeyChartValue(record[targetColumn.id]);
      if (sourceValue === undefined || targetValue === undefined) continue;

      const source = getNode(sourceColumn, sourceValue);
      const target = getNode(targetColumn, targetValue);
      const id = `${source.node.id}->${target.node.id}`;
      const existingLink = linksById.get(id);

      if (existingLink) {
        existingLink.value += weight;
        existingLink.records.push(record);
      } else {
        linksById.set(id, {
          id,
          source: source.index,
          target: target.index,
          value: weight,
          sourceNode: source.node,
          targetNode: target.node,
          records: [record],
        });
      }
    }
  }

  return { nodes, links: [...linksById.values()] };
}

export function getSankeyChartNodeWeights(graph: SankeyChartGraph): Map<string, number> {
  const incomingWeights = new Map<string, number>();
  const outgoingWeights = new Map<string, number>();

  for (const link of graph.links) {
    outgoingWeights.set(link.sourceNode.id, (outgoingWeights.get(link.sourceNode.id) ?? 0) + link.value);
    incomingWeights.set(link.targetNode.id, (incomingWeights.get(link.targetNode.id) ?? 0) + link.value);
  }

  return new Map(
    graph.nodes.map(node => [node.id, Math.max(incomingWeights.get(node.id) ?? 0, outgoingWeights.get(node.id) ?? 0)]),
  );
}

export function getSankeyChartCurveSelection(link: SankeyChartLink): SankeyChartCurveSelection {
  return {
    source: { column: link.sourceNode.column, value: link.sourceNode.value },
    target: { column: link.targetNode.column, value: link.targetNode.value },
    records: link.records,
  };
}

function createNodeId(columnId: string, value: string | number) {
  return JSON.stringify([columnId, typeof value, value]);
}
