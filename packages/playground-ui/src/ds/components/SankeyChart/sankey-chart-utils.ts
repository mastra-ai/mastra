export type SankeyChartRecord = Record<string, unknown>;

export type SankeyChartColumn = {
  id: string;
  label: string;
};

export type SankeyChartNode = {
  id: string;
  name: string;
  label: string;
  column: SankeyChartColumn;
  value: string | number;
  displayValue?: number;
};

export type SankeyChartLink = {
  id: string;
  source: number;
  target: number;
  value: number;
  displayValue: number;
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
  getRecordNodeId?: (record: SankeyChartRecord, column: SankeyChartColumn) => string,
  getRecordNodeLabel?: (record: SankeyChartRecord, column: SankeyChartColumn) => string,
  getRecordNodeValue?: (record: SankeyChartRecord, column: SankeyChartColumn) => number,
  getRecordLayoutWeight?: (record: SankeyChartRecord) => number,
): SankeyChartGraph {
  if (columns.length < 2 || data.length === 0) return EMPTY_GRAPH;

  const nodes: Array<SankeyChartNode> = [];
  const nodeIndexes = new Map<string, number>();
  const linksById = new Map<string, SankeyChartLink>();

  const getNode = (
    column: SankeyChartColumn,
    value: string | number,
    label: string,
    displayValue: number | undefined,
  ): { node: SankeyChartNode; index: number } => {
    const id = createNodeId(column.id, value);
    const existingIndex = nodeIndexes.get(id);
    const existingNode = existingIndex === undefined ? undefined : nodes[existingIndex];
    if (existingIndex !== undefined && existingNode) return { node: existingNode, index: existingIndex };

    const node: SankeyChartNode = { id, name: String(value), label, column, value, displayValue };
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
      const displayWeight = getRecordWeight(record);
      const layoutWeight = getRecordLayoutWeight?.(record) ?? displayWeight;
      if (!Number.isFinite(displayWeight) || displayWeight < 0 || !Number.isFinite(layoutWeight) || layoutWeight < 0) {
        continue;
      }

      const sourceRecordValue = getSankeyChartValue(record[sourceColumn.id]);
      const targetRecordValue = getSankeyChartValue(record[targetColumn.id]);
      if (sourceRecordValue === undefined || targetRecordValue === undefined) continue;

      const sourceValue = getRecordNodeId
        ? getSankeyChartValue(getRecordNodeId(record, sourceColumn))
        : sourceRecordValue;
      const targetValue = getRecordNodeId
        ? getSankeyChartValue(getRecordNodeId(record, targetColumn))
        : targetRecordValue;
      if (sourceValue === undefined || targetValue === undefined) continue;

      const sourceLabel = getRecordNodeLabel?.(record, sourceColumn) ?? String(sourceRecordValue);
      const targetLabel = getRecordNodeLabel?.(record, targetColumn) ?? String(targetRecordValue);
      const sourceDisplayValue = getRecordNodeValue?.(record, sourceColumn);
      const targetDisplayValue = getRecordNodeValue?.(record, targetColumn);
      const source = getNode(
        sourceColumn,
        sourceValue,
        sourceLabel,
        sourceDisplayValue !== undefined && Number.isFinite(sourceDisplayValue) && sourceDisplayValue >= 0
          ? sourceDisplayValue
          : undefined,
      );
      const target = getNode(
        targetColumn,
        targetValue,
        targetLabel,
        targetDisplayValue !== undefined && Number.isFinite(targetDisplayValue) && targetDisplayValue >= 0
          ? targetDisplayValue
          : undefined,
      );
      const id = `${source.node.id}->${target.node.id}`;
      const existingLink = linksById.get(id);

      if (existingLink) {
        existingLink.value += layoutWeight;
        existingLink.displayValue += displayWeight;
        existingLink.records.push(record);
      } else {
        linksById.set(id, {
          id,
          source: source.index,
          target: target.index,
          value: layoutWeight,
          displayValue: displayWeight,
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
