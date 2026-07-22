import { describe, expect, it } from 'vitest';

import {
  buildSankeyChartGraph,
  getSankeyChartCurveSelection,
  getSankeyChartNodeWeights,
  getSankeyChartValue,
  reorderSankeyChartColumns,
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

  describe('when node display values differ from layout weights', () => {
    it('preserves the supplied node values independently of link weights', () => {
      const graph = buildSankeyChartGraph(
        [{ source: 'source-1', sourceCount: 0, model: 'model-1', modelCount: 3, layoutWeight: 0.01 }],
        columns.slice(0, 2),
        record => Number(record.layoutWeight),
        undefined,
        undefined,
        (record, column) => Number(record[`${column.id}Count`]),
      );

      expect(graph.links[0]?.value).toBe(0.01);
      expect(graph.nodes.map(node => node.displayValue)).toEqual([0, 3]);
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
});
