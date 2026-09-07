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

    it('budgets a label against the node it hangs off', () => {
      // Pinned rather than recomputed: the arithmetic is the thing under test.
      expect(getSankeyLabelWidths(layout)).toEqual({ centered: 227, edge: 117 });
    });

    it('budgets a two-column chart against its single pitch', () => {
      expect(getSankeyLabelWidths({ ...layout, columnCount: 2 })).toEqual({ centered: 713, edge: 360 });
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

    it('leaves a label sitting exactly on the limit untouched', () => {
      expect(truncateSankeyLabel('abcde', { fontSize: 11, maxWidth: Number.POSITIVE_INFINITY, maxCharacters: 5 })).toBe(
        'abcde',
      );
      expect(
        truncateSankeyLabel('abcdef', { fontSize: 11, maxWidth: Number.POSITIVE_INFINITY, maxCharacters: 5 }),
      ).toBe('abcd…');
    });

    it('shows nothing but an ellipsis when there is room for one character', () => {
      expect(truncateSankeyLabel('abcde', { fontSize: 11, maxWidth: Number.POSITIVE_INFINITY, maxCharacters: 1 })).toBe(
        '…',
      );
      expect(truncateSankeyLabel('abcde', { fontSize: 11, maxWidth: Number.POSITIVE_INFINITY, maxCharacters: 2 })).toBe(
        'a…',
      );
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

  describe('when a dimension value is not usable', () => {
    it.each([
      ['a boolean', true],
      ['null', null],
      ['undefined', undefined],
      ['an array', ['GPT']],
      ['a blank string', '   '],
      ['an empty string', ''],
      ['NaN', Number.NaN],
      ['Infinity', Number.POSITIVE_INFINITY],
    ])('rejects %s', (_, value) => {
      expect(getSankeyChartValue(value)).toBeUndefined();
    });

    it('keeps a finite number, including zero and negatives', () => {
      expect(getSankeyChartValue(0)).toBe(0);
      expect(getSankeyChartValue(-4)).toBe(-4);
      expect(getSankeyChartValue(4.5)).toBe(4.5);
    });

    it('trims a string down to its content', () => {
      expect(getSankeyChartValue('  API  ')).toBe('API');
    });
  });

  describe('when a column move cannot be made', () => {
    it.each([
      ['the column has not moved', 1, 1],
      ['the start index is negative', -1, 1],
      ['the end index is negative', 1, -1],
      ['the start index is past the last column', 3, 1],
      ['the end index is past the last column', 1, 3],
      ['the start index is exactly the column count', 3, 0],
      ['the end index is exactly the column count', 0, 3],
    ])('returns the same array when %s', (_, startIndex, endIndex) => {
      expect(reorderSankeyChartColumns(columns, startIndex, endIndex)).toBe(columns);
    });

    it('moves a column backwards as well as forwards', () => {
      expect(reorderSankeyChartColumns(columns, 2, 0).map(column => column.id)).toEqual(['status', 'source', 'model']);
      expect(reorderSankeyChartColumns(columns, 0, 1).map(column => column.id)).toEqual(['model', 'source', 'status']);
    });
  });

  describe('when there is nothing to chart', () => {
    it('returns the one shared empty graph rather than a new one each time', () => {
      // The chart re-renders on every stream tick; a fresh object each time
      // would invalidate every memo downstream.
      expect(buildSankeyChartGraph([], columns)).toBe(buildSankeyChartGraph([{ source: 'API' }], columns.slice(0, 1)));
    });
  });

  describe('when a record weight sits on a boundary', () => {
    const twoColumns = columns.slice(0, 2);
    const record = { source: 'API', model: 'GPT' };

    it('keeps a record weighted exactly zero', () => {
      const graph = buildSankeyChartGraph([record], twoColumns, () => 0);

      expect(graph.links).toHaveLength(1);
      expect(graph.links[0]).toMatchObject({ value: 0, displayValue: 0 });
    });

    it('keeps a record whose layout weight is exactly zero', () => {
      const graph = buildSankeyChartGraph(
        [record],
        twoColumns,
        () => 2,
        undefined,
        undefined,
        undefined,
        () => 0,
      );

      expect(graph.links[0]).toMatchObject({ value: 0, displayValue: 2 });
    });

    it.each([
      ['a non-finite display weight', () => Number.NaN, () => 1],
      ['a negative display weight', () => -1, () => 1],
      ['a non-finite layout weight', () => 1, () => Number.NaN],
      ['a negative layout weight', () => 1, () => -1],
    ])('drops a record with %s', (_, getRecordWeight, getRecordLayoutWeight) => {
      const graph = buildSankeyChartGraph(
        [record],
        twoColumns,
        getRecordWeight,
        undefined,
        undefined,
        undefined,
        getRecordLayoutWeight,
      );

      expect(graph.links).toHaveLength(0);
    });
  });

  describe('when a custom node identity is unusable', () => {
    const twoColumns = columns.slice(0, 2);
    const data = [{ source: 'API', model: 'GPT' }];

    it.each([['source'], ['model']])('drops the record when the %s identity is blank', columnId => {
      const graph = buildSankeyChartGraph(data, twoColumns, undefined, (record, column) =>
        column.id === columnId ? '  ' : String(record[column.id]),
      );

      expect(graph.links).toHaveLength(0);
    });
  });

  describe('when a custom node value is unusable', () => {
    const twoColumns = columns.slice(0, 2);
    const nodeValues = (sourceCount: unknown, modelCount: unknown) =>
      buildSankeyChartGraph(
        [{ source: 'API', model: 'GPT', sourceCount, modelCount }],
        twoColumns,
        () => 1,
        undefined,
        undefined,
        (record, column) => record[`${column.id}Count`] as number,
      ).nodes.map(node => node.displayValue);

    it('keeps a node value of exactly zero on either end', () => {
      expect(nodeValues(0, 0)).toEqual([0, 0]);
    });

    it.each([
      ['non-finite', Number.NaN],
      ['negative', -5],
      ['missing', undefined],
    ])('drops a %s node value on either end', (_, value) => {
      expect(nodeValues(value, value)).toEqual([undefined, undefined]);
    });
  });

  describe('when a graph carries no current value', () => {
    it('draws nodes and ribbons with no height rather than dividing by zero', () => {
      const graph = buildSankeyChartGraph([{ source: 'A', model: 'X', count: 0 }], columns.slice(0, 2), record =>
        Number(record.count),
      );
      const geometry = buildFixedSankeyGeometry(graph, {
        top: 0,
        bottom: 200,
        left: 100,
        right: 500,
        nodePadding: 20,
      });

      for (const node of geometry.nodes.values()) expect(node.height).toBe(0);
      for (const link of geometry.links.values()) {
        expect(link.sourceWidth).toBe(0);
        expect(link.targetWidth).toBe(0);
      }
    });

    it('sizes a pass-through node by its larger side', () => {
      // X takes 3 in and passes 1 on: the bar must show the 3 it received.
      const graph = buildSankeyChartGraph(
        [
          { source: 'A', model: 'X', status: 'S', count: 3 },
          { source: 'A2', model: 'X', status: 'S2', count: 1 },
        ],
        columns,
        record => Number(record.count),
      );
      const geometry = buildFixedSankeyGeometry(graph, {
        top: 0,
        bottom: 200,
        left: 100,
        right: 500,
        nodePadding: 20,
      });

      const nodeX = graph.nodes.find(node => node.name === 'X');
      const nodeS = graph.nodes.find(node => node.name === 'S');
      const heightOf = (id: string | undefined) => geometry.nodes.get(id ?? '')?.height ?? 0;

      // X carries 4 in total; S only 3 of it.
      expect(heightOf(nodeX?.id)).toBeGreaterThan(heightOf(nodeS?.id));
    });
  });

  describe('when link and node geometry is measured off the origin', () => {
    const twoColumns = columns.slice(0, 2);
    const graph = buildSankeyChartGraph(
      [
        { source: 'A', model: 'X', count: 6 },
        { source: 'A', model: 'Y', count: 2 },
        { source: 'B', model: 'X', count: 2 },
        { source: 'B', model: 'Z', count: 1 },
      ],
      twoColumns,
      record => Number(record.count),
    );
    const geometry = buildFixedSankeyGeometry(graph, {
      top: 40,
      bottom: 240,
      left: 100,
      right: 500,
      nodePadding: 20,
    });
    const nodeOf = (name: string) => geometry.nodes.get(graph.nodes.find(node => node.name === name)?.id ?? '');
    const linkOf = (source: string, target: string) =>
      geometry.links.get(
        graph.links.find(link => link.sourceNode.name === source && link.targetNode.name === target)?.id ?? '',
      );

    it('measures slot heights from the band it was given, not from the origin', () => {
      // Pinned: a band of 200px starting at y=40, three slots on the widest column.
      expect(nodeOf('A')?.centerY).toBe(85);
      expect(nodeOf('A')?.height).toBeCloseTo(23.272727, 5);
    });

    it('sizes ribbons from their share of each end', () => {
      expect(linkOf('A', 'X')?.sourceWidth).toBeCloseTo(17.454545, 5);
      expect(linkOf('A', 'Y')?.sourceWidth).toBeCloseTo(5.818181, 5);
      // A's two ribbons together fill A's bar exactly.
      expect((linkOf('A', 'X')?.sourceWidth ?? 0) + (linkOf('A', 'Y')?.sourceWidth ?? 0)).toBeCloseTo(
        nodeOf('A')?.height ?? 0,
        5,
      );
    });

    it('sizes the far end of a ribbon against what its target receives', () => {
      expect(linkOf('A', 'X')?.targetWidth).toBeCloseTo(17.454545, 5);
      expect(linkOf('B', 'X')?.targetWidth).toBeCloseTo(5.818181, 5);
      // X's two incoming ribbons together fill X's bar exactly.
      expect((linkOf('A', 'X')?.targetWidth ?? 0) + (linkOf('B', 'X')?.targetWidth ?? 0)).toBeCloseTo(
        nodeOf('X')?.height ?? 0,
        5,
      );
    });

    it('stacks incoming ribbons down a target bar', () => {
      const first = linkOf('A', 'X');
      const second = linkOf('B', 'X');

      expect(second?.targetY).toBeGreaterThan(first?.targetY ?? 0);
      expect((first?.targetY ?? 0) + (first?.targetWidth ?? 0) / 2).toBeCloseTo(
        (second?.targetY ?? 0) - (second?.targetWidth ?? 0) / 2,
        5,
      );
    });

    it('stacks a node’s ribbons instead of drawing them on top of each other', () => {
      const first = linkOf('A', 'X');
      const second = linkOf('A', 'Y');

      expect(second?.sourceY).toBeGreaterThan(first?.sourceY ?? 0);
      expect((first?.sourceY ?? 0) + (first?.sourceWidth ?? 0) / 2).toBeCloseTo(
        (second?.sourceY ?? 0) - (second?.sourceWidth ?? 0) / 2,
        5,
      );
    });

    it('scales every column against the tightest one', () => {
      // The model column packs three nodes into the same band as the source
      // column's two, so its slot is what caps every bar in the chart.
      expect(nodeOf('X')?.height).toBeCloseTo(nodeOf('A')?.height ?? 0, 5);
    });
  });

  describe('when the same link appears twice', () => {
    it('adds up both its layout and its current value', () => {
      const graph = buildSankeyChartGraph(
        [
          { source: 'A', model: 'X', count: 3 },
          { source: 'A', model: 'X', count: 4 },
        ],
        columns.slice(0, 2),
        record => Number(record.count),
      );

      expect(graph.nodes).toHaveLength(2);
      expect(graph.links).toHaveLength(1);
      expect(graph.links[0]).toMatchObject({ value: 7, displayValue: 7 });
    });
  });
});
