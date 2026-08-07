import { describe, expect, it } from 'vitest';

import {
  buildFixedSankeyGeometry,
  buildSankeyChartGraph,
  getSankeyChartCurveSelection,
  getSankeyChartNodeWeights,
  getSankeyChartValue,
  getSankeyLabelWidths,
  reorderSankeyChartColumns,
  SANKEY_NODE_WIDTH,
  truncateSankeyLabel,
} from './sankey-chart-utils';

const columns = [
  { id: 'source', label: 'Source' },
  { id: 'model', label: 'Model' },
  { id: 'status', label: 'Status' },
];

describe('SankeyChart utilities', () => {
  describe('when records contain repeated adjacent values', () => {
    it('aggregates link totals and preserves their contributing records', () => {
      const data = [
        { id: 'one', source: 'API', model: 'GPT', status: 'Success' },
        { id: 'two', source: 'API', model: 'GPT', status: 'Error' },
        { id: 'three', source: 'UI', model: 'GPT', status: 'Success' },
      ];

      const graph = buildSankeyChartGraph(data, columns);
      const apiToGpt = graph.links.find(link => link.sourceNode.value === 'API' && link.targetNode.value === 'GPT');

      expect(apiToGpt?.value).toBe(2);
      expect(apiToGpt?.records).toEqual([data[0], data[1]]);
      expect(apiToGpt && getSankeyChartCurveSelection(apiToGpt)).toEqual({
        source: { column: columns[0], value: 'API' },
        target: { column: columns[1], value: 'GPT' },
        records: [data[0], data[1]],
      });
    });
  });

  describe('when records provide explicit weights', () => {
    it('sums weights for matching links without duplicating records', () => {
      const data = [
        { source: 'API', model: 'GPT', count: 2 },
        { source: 'API', model: 'GPT', count: 3 },
      ];

      const graph = buildSankeyChartGraph(data, columns.slice(0, 2), record => Number(record.count));

      expect(graph.links[0]).toMatchObject({ value: 5, records: data });
    });
  });

  describe('when records provide invalid weights', () => {
    it('excludes them from the graph', () => {
      const validRecord = { source: 'API', model: 'GPT', count: 2 };
      const data = [
        validRecord,
        { source: 'CLI', model: 'Claude', count: Number.NaN },
        { source: 'UI', model: 'Gemini', count: Number.POSITIVE_INFINITY },
        { source: 'SDK', model: 'Llama', count: -1 },
      ];

      const graph = buildSankeyChartGraph(data, columns.slice(0, 2), record => Number(record.count));

      expect(graph).toMatchObject({
        nodes: [{ value: 'API' }, { value: 'GPT' }],
        links: [{ value: 2, records: [validRecord] }],
      });
    });
  });

  describe('when graph nodes have weighted incoming and outgoing links', () => {
    it('derives source, target, and intermediate node weights using Sankey conservation', () => {
      const graph = buildSankeyChartGraph(
        [
          { source: 'API', model: 'GPT', status: 'Success', count: 2 },
          { source: 'API', model: 'GPT', status: 'Error', count: 3 },
          { source: 'UI', model: 'GPT', status: 'Success', count: 4 },
        ],
        columns,
        record => Number(record.count),
      );

      expect(Object.fromEntries(getSankeyChartNodeWeights(graph))).toEqual({
        '["source","string","API"]': 5,
        '["model","string","GPT"]': 9,
        '["status","string","Success"]': 6,
        '["status","string","Error"]': 3,
        '["source","string","UI"]': 4,
      });
    });

    it('uses the greater total when an intermediate node has mismatched incoming and outgoing weights', () => {
      const graph = buildSankeyChartGraph(
        [
          { source: 'API', model: 'GPT', status: 'Success', count: 2 },
          { source: 'UI', model: 'GPT', status: '', count: 5 },
        ],
        columns,
        record => Number(record.count),
      );

      expect(getSankeyChartNodeWeights(graph).get('["model","string","GPT"]')).toBe(7);
    });
  });

  describe('when equal labels appear in different dimensions', () => {
    it('creates distinct nodes keyed by their columns', () => {
      const graph = buildSankeyChartGraph([{ source: 'Shared', model: 'Shared' }], columns.slice(0, 2));

      expect(graph.nodes).toHaveLength(2);
      expect(graph.nodes[0]?.id).not.toBe(graph.nodes[1]?.id);
      expect(graph.links[0]).toMatchObject({ source: 0, target: 1, value: 1 });
    });
  });

  describe('when records have equal display labels with distinct identities', () => {
    it('creates distinct nodes with their own weights', () => {
      const data = [
        { source: 'source-1', sourceLabel: 'Shared', model: 'model-1', modelLabel: 'Model', count: 2 },
        { source: 'source-2', sourceLabel: 'Shared', model: 'model-1', modelLabel: 'Model', count: 3 },
      ];
      const getNodeId = (record: Record<string, unknown>, column: { id: string }) => String(record[column.id]);
      const getNodeLabel = (record: Record<string, unknown>, column: { id: string }) =>
        String(record[`${column.id}Label`]);

      const graph = buildSankeyChartGraph(
        data,
        columns.slice(0, 2),
        record => Number(record.count),
        getNodeId,
        getNodeLabel,
      );
      const sourceNodes = graph.nodes.filter(node => node.column.id === 'source');
      const weights = getSankeyChartNodeWeights(graph);

      expect(sourceNodes.map(node => ({ label: node.label, value: node.value, weight: weights.get(node.id) }))).toEqual(
        [
          { label: 'Shared', value: 'source-1', weight: 2 },
          { label: 'Shared', value: 'source-2', weight: 3 },
        ],
      );
    });
  });

  describe('when display values differ from layout weights', () => {
    it('preserves current link and node values independently of stable layout weights', () => {
      const graph = buildSankeyChartGraph(
        [{ source: 'source-1', sourceCount: 0, model: 'model-1', modelCount: 3, count: 2, layoutWeight: 5 }],
        columns.slice(0, 2),
        record => Number(record.count),
        undefined,
        undefined,
        (record, column) => Number(record[`${column.id}Count`]),
        record => Number(record.layoutWeight),
      );

      expect(graph.links[0]).toMatchObject({ value: 5, displayValue: 2 });
      expect(graph.nodes.map(node => node.displayValue)).toEqual([0, 3]);
    });
  });

  describe('when fixed theme slots render current values', () => {
    it('keeps node centers fixed and packs ribbons contiguously inside resized bars', () => {
      const graph = buildSankeyChartGraph(
        [
          { source: 'A', sourceCount: 8, model: 'X', modelCount: 8, count: 6, layoutCount: 10 },
          { source: 'A', sourceCount: 8, model: 'Y', modelCount: 2, count: 2, layoutCount: 10 },
          { source: 'B', sourceCount: 2, model: 'X', modelCount: 8, count: 2, layoutCount: 10 },
        ],
        columns.slice(0, 2),
        record => Number(record.count),
        undefined,
        undefined,
        (record, column) => Number(record[`${column.id}Count`]),
        record => Number(record.layoutCount),
      );

      const geometry = buildFixedSankeyGeometry(graph, {
        top: 0,
        bottom: 200,
        left: 100,
        right: 500,
        nodePadding: 20,
      });
      const sourceA = geometry.nodes.get(graph.nodes.find(node => node.name === 'A')?.id ?? '');
      const sourceB = geometry.nodes.get(graph.nodes.find(node => node.name === 'B')?.id ?? '');
      const targetX = geometry.nodes.get(graph.nodes.find(node => node.name === 'X')?.id ?? '');
      const aToX = geometry.links.get(
        graph.links.find(link => link.sourceNode.name === 'A' && link.targetNode.name === 'X')?.id ?? '',
      );
      const aToY = geometry.links.get(
        graph.links.find(link => link.sourceNode.name === 'A' && link.targetNode.name === 'Y')?.id ?? '',
      );
      const bToX = geometry.links.get(
        graph.links.find(link => link.sourceNode.name === 'B' && link.targetNode.name === 'X')?.id ?? '',
      );

      expect(sourceA?.x).toBe(100);
      expect(sourceB?.x).toBe(100);
      expect(targetX?.x).toBe(500);
      expect(sourceA?.centerY).toBe(45);
      expect(sourceB?.centerY).toBe(155);
      expect(sourceA?.height).toBe(43.2);
      expect(sourceA?.height).toBeGreaterThan(sourceB?.height ?? 0);
      expect((aToX?.sourceY ?? 0) + (aToX?.sourceWidth ?? 0) / 2).toBeCloseTo(
        (aToY?.sourceY ?? 0) - (aToY?.sourceWidth ?? 0) / 2,
      );
      expect((aToX?.targetY ?? 0) + (aToX?.targetWidth ?? 0) / 2).toBeCloseTo(
        (bToX?.targetY ?? 0) - (bToX?.targetWidth ?? 0) / 2,
      );
    });

    it('scales percentages against one chart-wide maximum height', () => {
      const graph = buildSankeyChartGraph(
        [
          { source: 'A', sourceCount: 70, model: 'X', modelCount: 100, count: 70, layoutCount: 100 },
          { source: 'B', sourceCount: 30, model: 'X', modelCount: 100, count: 30, layoutCount: 100 },
          { source: 'B', sourceCount: 30, model: 'Y', modelCount: 0, count: 0, layoutCount: 1 },
          { source: 'B', sourceCount: 30, model: 'Z', modelCount: 0, count: 0, layoutCount: 1 },
          { source: 'B', sourceCount: 30, model: 'W', modelCount: 0, count: 0, layoutCount: 1 },
        ],
        columns.slice(0, 2),
        record => Number(record.count),
        undefined,
        undefined,
        (record, column) => Number(record[`${column.id}Count`]),
        record => Number(record.layoutCount),
      );
      const geometry = buildFixedSankeyGeometry(graph, {
        top: 0,
        bottom: 200,
        left: 100,
        right: 500,
        nodePadding: 20,
      });
      const sourceA = geometry.nodes.get(graph.nodes.find(node => node.name === 'A')?.id ?? '');
      const targetX = geometry.nodes.get(graph.nodes.find(node => node.name === 'X')?.id ?? '');

      expect(targetX?.height).toBeGreaterThan(sourceA?.height ?? 0);
      expect((sourceA?.height ?? 0) / (targetX?.height ?? 1)).toBeCloseTo(0.7);
    });
  });

  describe('when the graph is disconnected across fixed columns', () => {
    it('anchors each ribbon to its own nodes instead of the depth-based edges', () => {
      const fourColumns = [
        { id: 'goal', label: 'Goal' },
        { id: 'outcome', label: 'Outcome' },
        { id: 'behavior', label: 'Behavior' },
        { id: 'sentiment', label: 'Sentiment' },
      ];
      // links exist only for goal->outcome and behavior->sentiment: outcome and
      // sentiment have no outgoing links, so depth-based layouts push them to
      // the last column while the fixed columns stay evenly spaced.
      const graph = buildSankeyChartGraph(
        [
          { goal: 'A', outcome: 'B', count: 2, layoutCount: 2 },
          { behavior: 'C', sentiment: 'D', count: 14, layoutCount: 14 },
        ],
        fourColumns,
        record => Number(record.count),
        undefined,
        undefined,
        undefined,
        record => Number(record.layoutCount),
      );

      const geometry = buildFixedSankeyGeometry(graph, {
        top: 0,
        bottom: 200,
        left: 100,
        right: 400,
        nodePadding: 20,
      });
      const aToB = geometry.links.get(
        graph.links.find(link => link.sourceNode.value === 'A' && link.targetNode.value === 'B')?.id ?? '',
      );
      const cToD = geometry.links.get(
        graph.links.find(link => link.sourceNode.value === 'C' && link.targetNode.value === 'D')?.id ?? '',
      );

      expect(aToB?.sourceX).toBe(100 + SANKEY_NODE_WIDTH);
      expect(aToB?.targetX).toBe(200);
      expect(cToD?.sourceX).toBe(300 + SANKEY_NODE_WIDTH);
      expect(cToD?.targetX).toBe(400);
    });
  });

  describe('when only one optional node accessor is provided', () => {
    it('keeps record values as labels when only identity is customized', () => {
      const graph = buildSankeyChartGraph(
        [{ source: 'Readable source', sourceId: 'source-1', model: 'Readable model', modelId: 'model-1' }],
        columns.slice(0, 2),
        undefined,
        (record, column) => String(record[`${column.id}Id`]),
      );

      expect(graph.nodes.map(node => ({ label: node.label, value: node.value }))).toEqual([
        { label: 'Readable source', value: 'source-1' },
        { label: 'Readable model', value: 'model-1' },
      ]);
    });

    it('keeps record values as identities when only labels are customized', () => {
      const graph = buildSankeyChartGraph(
        [{ source: 'source-1', sourceLabel: 'Readable source', model: 'model-1', modelLabel: 'Readable model' }],
        columns.slice(0, 2),
        undefined,
        undefined,
        (record, column) => String(record[`${column.id}Label`]),
      );

      expect(graph.nodes.map(node => ({ label: node.label, value: node.value }))).toEqual([
        { label: 'Readable source', value: 'source-1' },
        { label: 'Readable model', value: 'model-1' },
      ]);
    });
  });

  describe('when values cannot form a flow', () => {
    it('ignores blank, non-finite, and non-primitive dimension values', () => {
      const data = [
        { source: 'API', model: '' },
        { source: 'API', model: Number.NaN },
        { source: 'API', model: { name: 'GPT' } },
        { source: ' API ', model: 4 },
      ];

      const graph = buildSankeyChartGraph(data, columns.slice(0, 2));

      expect(graph.links).toHaveLength(1);
      expect(graph.nodes.map(node => node.value)).toEqual(['API', 4]);
      expect(getSankeyChartValue(Number.POSITIVE_INFINITY)).toBeUndefined();
    });

    it('returns an empty graph with fewer than two columns', () => {
      expect(buildSankeyChartGraph([{ source: 'API' }], columns.slice(0, 1))).toEqual({ nodes: [], links: [] });
    });
  });

  describe('when columns are reordered', () => {
    it('moves the selected column without mutating the input', () => {
      const reordered = reorderSankeyChartColumns(columns, 0, 2);

      expect(reordered.map(column => column.id)).toEqual(['model', 'status', 'source']);
      expect(columns.map(column => column.id)).toEqual(['source', 'model', 'status']);
    });
  });

  describe('when budgeting horizontal space for labels', () => {
    const nodeWidth = 7;
    const layout = { chartWidth: 800, columnCount: 4, marginLeft: 32, marginRight: 32 };
    const columnPitch = (layout.chartWidth - layout.marginLeft - layout.marginRight - nodeWidth) / 3;

    it('keeps two centered neighbours apart', () => {
      const { centered } = getSankeyLabelWidths(layout);

      expect(centered / 2 + centered / 2).toBeLessThan(columnPitch);
    });

    it('keeps an edge label clear of its centered neighbour', () => {
      const { centered, edge } = getSankeyLabelWidths(layout);

      expect(edge + centered / 2).toBeLessThan(columnPitch + nodeWidth / 2);
    });

    it('shrinks the budget as the chart narrows', () => {
      const wide = getSankeyLabelWidths(layout);
      const narrow = getSankeyLabelWidths({ ...layout, chartWidth: 400 });

      expect(narrow.centered).toBeLessThan(wide.centered);
      expect(narrow.edge).toBeLessThan(wide.edge);
    });

    it('never budgets negative space', () => {
      const { centered, edge } = getSankeyLabelWidths({ ...layout, chartWidth: 40 });

      expect(centered).toBe(0);
      expect(edge).toBe(0);
    });

    it('leaves labels unbounded before the chart is measured', () => {
      expect(getSankeyLabelWidths({ ...layout, chartWidth: 0 })).toEqual({
        centered: Number.POSITIVE_INFINITY,
        edge: Number.POSITIVE_INFINITY,
      });
    });

    it('leaves labels unbounded when a single column has no neighbour', () => {
      expect(getSankeyLabelWidths({ ...layout, columnCount: 1 })).toEqual({
        centered: Number.POSITIVE_INFINITY,
        edge: Number.POSITIVE_INFINITY,
      });
    });
  });

  describe('when a label fits its budget', () => {
    it('leaves it untouched', () => {
      expect(truncateSankeyLabel('Success', { fontSize: 11, maxWidth: 220 })).toBe('Success');
    });

    it('leaves it untouched when the width is unbounded', () => {
      const label = 'Repeated command calls without confirmation';

      expect(truncateSankeyLabel(label, { fontSize: 11, maxWidth: Number.POSITIVE_INFINITY })).toBe(label);
    });
  });

  describe('when a label overflows its budget', () => {
    it('clips it to an ellipsis that fits', () => {
      const label = 'Repeated command calls without confirmation';
      const truncated = truncateSankeyLabel(label, { fontSize: 11, maxWidth: 80 });

      expect(truncated.endsWith('…')).toBe(true);
      expect(truncated.length).toBeLessThan(label.length);
    });

    it('drops the trailing space before the ellipsis', () => {
      expect(truncateSankeyLabel('Repeated command calls', { fontSize: 11, maxWidth: 70 })).toBe('Repeated…');
    });

    it('collapses to a lone ellipsis when there is no room at all', () => {
      expect(truncateSankeyLabel('Anything', { fontSize: 11, maxWidth: 0 })).toBe('…');
    });
  });

  describe('when a character cap is set alongside the width budget', () => {
    it('applies the cap on an unbounded width', () => {
      const truncated = truncateSankeyLabel('a'.repeat(40), {
        fontSize: 11,
        maxWidth: Number.POSITIVE_INFINITY,
        maxCharacters: 23,
      });

      expect(truncated).toBe(`${'a'.repeat(22)}…`);
    });

    it('applies the width budget when it is tighter than the cap', () => {
      const truncated = truncateSankeyLabel('a'.repeat(40), { fontSize: 11, maxWidth: 80, maxCharacters: 23 });

      expect(truncated.length).toBeLessThan(23);
    });
  });
});
