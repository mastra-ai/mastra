import { describe, it, expect } from 'vitest';
import type { StoredProcessorGraph } from '@mastra/core/storage';
import { fromStoredProcessorGraph, toStoredProcessorGraph } from '../utils/graph-serialization';

describe('graph-serialization', () => {
  describe('fromStoredProcessorGraph', () => {
    it('converts a graph with step entries', () => {
      const graph: StoredProcessorGraph = {
        steps: [
          {
            type: 'step',
            step: { id: 's1', providerId: 'moderation', config: { level: 'strict' }, enabledPhases: ['processInput'] },
          },
        ],
      };

      const state = fromStoredProcessorGraph(graph);
      expect(state.layers).toHaveLength(1);
      expect(state.layers[0]!.id).toBeTruthy();
      expect(state.layers[0]!.entry).toEqual(graph.steps[0]);
      expect(state.isDirty).toBe(false);
    });

    it('converts a graph with parallel entries', () => {
      const graph: StoredProcessorGraph = {
        steps: [
          {
            type: 'parallel',
            branches: [
              [{ type: 'step', step: { id: 's1', providerId: 'a', config: {}, enabledPhases: ['processInput'] } }],
              [
                {
                  type: 'step',
                  step: { id: 's2', providerId: 'b', config: {}, enabledPhases: ['processOutputResult'] },
                },
              ],
            ],
          },
        ],
      };

      const state = fromStoredProcessorGraph(graph);
      expect(state.layers).toHaveLength(1);
      expect(state.layers[0]!.entry.type).toBe('parallel');
    });

    it('converts a graph with conditional entries', () => {
      const graph: StoredProcessorGraph = {
        steps: [
          {
            type: 'conditional',
            conditions: [
              {
                steps: [
                  { type: 'step', step: { id: 's1', providerId: 'a', config: {}, enabledPhases: ['processInput'] } },
                ],
                rules: { operator: 'AND', conditions: [{ field: 'x', operator: 'equals', value: 1 }] },
              },
              {
                steps: [],
              },
            ],
          },
        ],
      };

      const state = fromStoredProcessorGraph(graph);
      expect(state.layers).toHaveLength(1);
      expect(state.layers[0]!.entry.type).toBe('conditional');
    });

    it('handles empty graph', () => {
      const state = fromStoredProcessorGraph({ steps: [] });
      expect(state.layers).toHaveLength(0);
      expect(state.isDirty).toBe(false);
    });
  });

  describe('toStoredProcessorGraph', () => {
    it('unwraps BuilderLayers back to entries', () => {
      const state = fromStoredProcessorGraph({
        steps: [
          {
            type: 'step',
            step: { id: 's1', providerId: 'moderation', config: { level: 'strict' }, enabledPhases: ['processInput'] },
          },
        ],
      });

      const graph = toStoredProcessorGraph(state);
      expect(graph.steps).toHaveLength(1);
      expect(graph.steps[0]!.type).toBe('step');
      if (graph.steps[0]!.type === 'step') {
        expect(graph.steps[0]!.step.providerId).toBe('moderation');
      }
    });
  });

  describe('round-trip', () => {
    it('preserves step entries through round-trip', () => {
      const original: StoredProcessorGraph = {
        steps: [
          {
            type: 'step',
            step: { id: 's1', providerId: 'moderation', config: { level: 'strict' }, enabledPhases: ['processInput'] },
          },
        ],
      };

      const state = fromStoredProcessorGraph(original);
      const result = toStoredProcessorGraph(state);
      expect(result).toEqual(original);
    });

    it('preserves parallel entries through round-trip', () => {
      const original: StoredProcessorGraph = {
        steps: [
          {
            type: 'parallel',
            branches: [
              [{ type: 'step', step: { id: 's1', providerId: 'a', config: {}, enabledPhases: ['processInput'] } }],
              [
                {
                  type: 'step',
                  step: { id: 's2', providerId: 'b', config: {}, enabledPhases: ['processOutputResult'] },
                },
              ],
            ],
          },
        ],
      };

      const state = fromStoredProcessorGraph(original);
      const result = toStoredProcessorGraph(state);
      expect(result).toEqual(original);
    });

    it('preserves conditional entries through round-trip', () => {
      const original: StoredProcessorGraph = {
        steps: [
          {
            type: 'conditional',
            conditions: [
              {
                steps: [
                  { type: 'step', step: { id: 's1', providerId: 'a', config: {}, enabledPhases: ['processInput'] } },
                ],
                rules: { operator: 'AND', conditions: [{ field: 'x', operator: 'equals', value: 1 }] },
              },
              { steps: [] },
            ],
          },
        ],
      };

      const state = fromStoredProcessorGraph(original);
      const result = toStoredProcessorGraph(state);
      expect(result).toEqual(original);
    });

    it('preserves mixed entry types through round-trip', () => {
      const original: StoredProcessorGraph = {
        steps: [
          {
            type: 'step',
            step: { id: 's1', providerId: 'moderation', config: {}, enabledPhases: ['processInput'] },
          },
          {
            type: 'parallel',
            branches: [
              [{ type: 'step', step: { id: 's2', providerId: 'a', config: {}, enabledPhases: ['processInput'] } }],
            ],
          },
          {
            type: 'conditional',
            conditions: [{ steps: [] }],
          },
        ],
      };

      const state = fromStoredProcessorGraph(original);
      const result = toStoredProcessorGraph(state);
      expect(result).toEqual(original);
    });
  });
});
