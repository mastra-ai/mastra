import { describe, it, expect } from 'vitest';
import type { ProcessorGraphBuilderState, ProcessorGraphBuilderAction, ProcessorGraphStep } from '../types';
import { processorGraphBuilderReducer } from '../hooks/use-processor-graph-builder';

function makeState(layers: ProcessorGraphBuilderState['layers'] = []): ProcessorGraphBuilderState {
  return { layers, isDirty: false };
}

function makeStep(overrides: Partial<ProcessorGraphStep> = {}): ProcessorGraphStep {
  return {
    id: 'step-1',
    providerId: 'test-provider',
    config: {},
    enabledPhases: ['processInput'],
    ...overrides,
  };
}

describe('processorGraphBuilderReducer', () => {
  describe('ADD_LAYER', () => {
    it('adds a step layer', () => {
      const state = makeState();
      const next = processorGraphBuilderReducer(state, { type: 'ADD_LAYER', layerType: 'step' });
      expect(next.layers).toHaveLength(1);
      expect(next.layers[0]!.entry.type).toBe('step');
      expect(next.isDirty).toBe(true);
    });

    it('adds a parallel layer', () => {
      const state = makeState();
      const next = processorGraphBuilderReducer(state, { type: 'ADD_LAYER', layerType: 'parallel' });
      expect(next.layers).toHaveLength(1);
      expect(next.layers[0]!.entry.type).toBe('parallel');
      if (next.layers[0]!.entry.type === 'parallel') {
        expect(next.layers[0]!.entry.branches).toHaveLength(1);
      }
    });

    it('adds a conditional layer', () => {
      const state = makeState();
      const next = processorGraphBuilderReducer(state, { type: 'ADD_LAYER', layerType: 'conditional' });
      expect(next.layers).toHaveLength(1);
      expect(next.layers[0]!.entry.type).toBe('conditional');
      if (next.layers[0]!.entry.type === 'conditional') {
        expect(next.layers[0]!.entry.conditions).toHaveLength(1);
      }
    });
  });

  describe('REMOVE_LAYER', () => {
    it('removes a layer by id', () => {
      const state = makeState([
        { id: 'layer-1', entry: { type: 'step', step: makeStep() } },
        { id: 'layer-2', entry: { type: 'step', step: makeStep({ id: 'step-2' }) } },
      ]);
      const next = processorGraphBuilderReducer(state, { type: 'REMOVE_LAYER', layerId: 'layer-1' });
      expect(next.layers).toHaveLength(1);
      expect(next.layers[0]!.id).toBe('layer-2');
      expect(next.isDirty).toBe(true);
    });

    it('does nothing for unknown id', () => {
      const state = makeState([{ id: 'layer-1', entry: { type: 'step', step: makeStep() } }]);
      const next = processorGraphBuilderReducer(state, { type: 'REMOVE_LAYER', layerId: 'unknown' });
      expect(next.layers).toHaveLength(1);
    });
  });

  describe('REORDER_LAYERS', () => {
    it('reorders layers by index', () => {
      const state = makeState([
        { id: 'a', entry: { type: 'step', step: makeStep({ id: 'a' }) } },
        { id: 'b', entry: { type: 'step', step: makeStep({ id: 'b' }) } },
        { id: 'c', entry: { type: 'step', step: makeStep({ id: 'c' }) } },
      ]);
      const next = processorGraphBuilderReducer(state, {
        type: 'REORDER_LAYERS',
        sourceIndex: 0,
        destinationIndex: 2,
      });
      expect(next.layers.map(l => l.id)).toEqual(['b', 'c', 'a']);
      expect(next.isDirty).toBe(true);
    });
  });

  describe('SET_LAYER_TYPE', () => {
    it('changes layer type while preserving id', () => {
      const state = makeState([{ id: 'layer-1', entry: { type: 'step', step: makeStep() } }]);
      const next = processorGraphBuilderReducer(state, {
        type: 'SET_LAYER_TYPE',
        layerId: 'layer-1',
        layerType: 'parallel',
      });
      expect(next.layers[0]!.id).toBe('layer-1');
      expect(next.layers[0]!.entry.type).toBe('parallel');
    });
  });

  describe('SET_STEP', () => {
    it('sets the step on a step layer', () => {
      const state = makeState([{ id: 'layer-1', entry: { type: 'step', step: makeStep({ providerId: '' }) } }]);
      const newStep = makeStep({ providerId: 'new-provider' });
      const next = processorGraphBuilderReducer(state, { type: 'SET_STEP', layerId: 'layer-1', step: newStep });
      if (next.layers[0]!.entry.type === 'step') {
        expect(next.layers[0]!.entry.step.providerId).toBe('new-provider');
      }
    });

    it('ignores non-step layers', () => {
      const state = makeState([{ id: 'layer-1', entry: { type: 'parallel', branches: [[]] } }]);
      const next = processorGraphBuilderReducer(state, {
        type: 'SET_STEP',
        layerId: 'layer-1',
        step: makeStep(),
      });
      expect(next.layers[0]!.entry.type).toBe('parallel');
    });
  });

  describe('UPDATE_STEP_CONFIG', () => {
    it('updates config on a step layer', () => {
      const state = makeState([{ id: 'layer-1', entry: { type: 'step', step: makeStep() } }]);
      const next = processorGraphBuilderReducer(state, {
        type: 'UPDATE_STEP_CONFIG',
        layerId: 'layer-1',
        config: { threshold: 0.8 },
      });
      if (next.layers[0]!.entry.type === 'step') {
        expect(next.layers[0]!.entry.step.config).toEqual({ threshold: 0.8 });
      }
    });
  });

  describe('UPDATE_STEP_PHASES', () => {
    it('updates phases on a step layer', () => {
      const state = makeState([{ id: 'layer-1', entry: { type: 'step', step: makeStep() } }]);
      const next = processorGraphBuilderReducer(state, {
        type: 'UPDATE_STEP_PHASES',
        layerId: 'layer-1',
        enabledPhases: ['processInput', 'processOutputResult'],
      });
      if (next.layers[0]!.entry.type === 'step') {
        expect(next.layers[0]!.entry.step.enabledPhases).toEqual(['processInput', 'processOutputResult']);
      }
    });
  });

  describe('ADD_BRANCH', () => {
    it('adds a branch to a parallel layer', () => {
      const state = makeState([{ id: 'layer-1', entry: { type: 'parallel', branches: [[]] } }]);
      const next = processorGraphBuilderReducer(state, { type: 'ADD_BRANCH', layerId: 'layer-1' });
      if (next.layers[0]!.entry.type === 'parallel') {
        expect(next.layers[0]!.entry.branches).toHaveLength(2);
      }
    });
  });

  describe('REMOVE_BRANCH', () => {
    it('removes a branch from a parallel layer', () => {
      const state = makeState([{ id: 'layer-1', entry: { type: 'parallel', branches: [[], []] } }]);
      const next = processorGraphBuilderReducer(state, {
        type: 'REMOVE_BRANCH',
        layerId: 'layer-1',
        branchIndex: 0,
      });
      if (next.layers[0]!.entry.type === 'parallel') {
        expect(next.layers[0]!.entry.branches).toHaveLength(1);
      }
    });
  });

  describe('ADD_STEP_TO_BRANCH', () => {
    it('adds a step to a parallel branch', () => {
      const state = makeState([{ id: 'layer-1', entry: { type: 'parallel', branches: [[]] } }]);
      const step = makeStep({ id: 'new-step' });
      const next = processorGraphBuilderReducer(state, {
        type: 'ADD_STEP_TO_BRANCH',
        layerId: 'layer-1',
        branchIndex: 0,
        step,
      });
      if (next.layers[0]!.entry.type === 'parallel') {
        expect(next.layers[0]!.entry.branches[0]).toHaveLength(1);
        const branchEntry = next.layers[0]!.entry.branches[0]![0]!;
        expect(branchEntry.type === 'step' && branchEntry.step.id).toBe('new-step');
      }
    });
  });

  describe('REMOVE_STEP_FROM_BRANCH', () => {
    it('removes a step from a parallel branch', () => {
      const state = makeState([
        {
          id: 'layer-1',
          entry: {
            type: 'parallel',
            branches: [[{ type: 'step' as const, step: makeStep() }]],
          },
        },
      ]);
      const next = processorGraphBuilderReducer(state, {
        type: 'REMOVE_STEP_FROM_BRANCH',
        layerId: 'layer-1',
        branchIndex: 0,
        stepIndex: 0,
      });
      if (next.layers[0]!.entry.type === 'parallel') {
        expect(next.layers[0]!.entry.branches[0]).toHaveLength(0);
      }
    });
  });

  describe('UPDATE_BRANCH_STEP_CONFIG', () => {
    it('updates config on a branch step', () => {
      const state = makeState([
        {
          id: 'layer-1',
          entry: {
            type: 'parallel',
            branches: [[{ type: 'step' as const, step: makeStep() }]],
          },
        },
      ]);
      const next = processorGraphBuilderReducer(state, {
        type: 'UPDATE_BRANCH_STEP_CONFIG',
        layerId: 'layer-1',
        branchIndex: 0,
        stepIndex: 0,
        config: { maxTokens: 100 },
      });
      if (next.layers[0]!.entry.type === 'parallel') {
        const e = next.layers[0]!.entry.branches[0]![0]!;
        expect(e.type === 'step' && e.step.config).toEqual({ maxTokens: 100 });
      }
    });
  });

  describe('UPDATE_BRANCH_STEP_PHASES', () => {
    it('updates phases on a branch step', () => {
      const state = makeState([
        {
          id: 'layer-1',
          entry: {
            type: 'parallel',
            branches: [[{ type: 'step' as const, step: makeStep() }]],
          },
        },
      ]);
      const next = processorGraphBuilderReducer(state, {
        type: 'UPDATE_BRANCH_STEP_PHASES',
        layerId: 'layer-1',
        branchIndex: 0,
        stepIndex: 0,
        enabledPhases: ['processOutputStream'],
      });
      if (next.layers[0]!.entry.type === 'parallel') {
        const e = next.layers[0]!.entry.branches[0]![0]!;
        expect(e.type === 'step' && e.step.enabledPhases).toEqual(['processOutputStream']);
      }
    });
  });

  describe('ADD_STEP_TO_CONDITION', () => {
    it('adds a step to a condition', () => {
      const state = makeState([{ id: 'layer-1', entry: { type: 'conditional', conditions: [{ steps: [] }] } }]);
      const step = makeStep({ id: 'cond-step' });
      const next = processorGraphBuilderReducer(state, {
        type: 'ADD_STEP_TO_CONDITION',
        layerId: 'layer-1',
        conditionIndex: 0,
        step,
      });
      if (next.layers[0]!.entry.type === 'conditional') {
        expect(next.layers[0]!.entry.conditions[0]!.steps).toHaveLength(1);
        const entry = next.layers[0]!.entry.conditions[0]!.steps[0]!;
        expect(entry.type === 'step' && entry.step.id).toBe('cond-step');
      }
      expect(next.isDirty).toBe(true);
    });

    it('ignores non-conditional layers', () => {
      const state = makeState([{ id: 'layer-1', entry: { type: 'step', step: makeStep() } }]);
      const next = processorGraphBuilderReducer(state, {
        type: 'ADD_STEP_TO_CONDITION',
        layerId: 'layer-1',
        conditionIndex: 0,
        step: makeStep(),
      });
      expect(next.layers[0]!.entry.type).toBe('step');
    });
  });

  describe('REMOVE_STEP_FROM_CONDITION', () => {
    it('removes a step from a condition', () => {
      const state = makeState([
        {
          id: 'layer-1',
          entry: {
            type: 'conditional',
            conditions: [{ steps: [{ type: 'step' as const, step: makeStep() }] }],
          },
        },
      ]);
      const next = processorGraphBuilderReducer(state, {
        type: 'REMOVE_STEP_FROM_CONDITION',
        layerId: 'layer-1',
        conditionIndex: 0,
        stepIndex: 0,
      });
      if (next.layers[0]!.entry.type === 'conditional') {
        expect(next.layers[0]!.entry.conditions[0]!.steps).toHaveLength(0);
      }
      expect(next.isDirty).toBe(true);
    });

    it('ignores non-conditional layers', () => {
      const state = makeState([{ id: 'layer-1', entry: { type: 'parallel', branches: [[]] } }]);
      const next = processorGraphBuilderReducer(state, {
        type: 'REMOVE_STEP_FROM_CONDITION',
        layerId: 'layer-1',
        conditionIndex: 0,
        stepIndex: 0,
      });
      expect(next.layers[0]!.entry.type).toBe('parallel');
    });
  });

  describe('ADD_CONDITION', () => {
    it('adds a condition to a conditional layer', () => {
      const state = makeState([{ id: 'layer-1', entry: { type: 'conditional', conditions: [{ steps: [] }] } }]);
      const next = processorGraphBuilderReducer(state, { type: 'ADD_CONDITION', layerId: 'layer-1' });
      if (next.layers[0]!.entry.type === 'conditional') {
        expect(next.layers[0]!.entry.conditions).toHaveLength(2);
      }
    });
  });

  describe('REMOVE_CONDITION', () => {
    it('removes a condition from a conditional layer', () => {
      const state = makeState([
        {
          id: 'layer-1',
          entry: { type: 'conditional', conditions: [{ steps: [] }, { steps: [] }] },
        },
      ]);
      const next = processorGraphBuilderReducer(state, {
        type: 'REMOVE_CONDITION',
        layerId: 'layer-1',
        conditionIndex: 0,
      });
      if (next.layers[0]!.entry.type === 'conditional') {
        expect(next.layers[0]!.entry.conditions).toHaveLength(1);
      }
    });
  });

  describe('UPDATE_CONDITION_RULES', () => {
    it('updates rules on a condition', () => {
      const state = makeState([{ id: 'layer-1', entry: { type: 'conditional', conditions: [{ steps: [] }] } }]);
      const rules = { operator: 'AND' as const, conditions: [{ field: 'x', operator: 'equals' as const, value: 1 }] };
      const next = processorGraphBuilderReducer(state, {
        type: 'UPDATE_CONDITION_RULES',
        layerId: 'layer-1',
        conditionIndex: 0,
        rules,
      });
      if (next.layers[0]!.entry.type === 'conditional') {
        expect(next.layers[0]!.entry.conditions[0]!.rules).toEqual(rules);
      }
    });

    it('clears rules when undefined', () => {
      const state = makeState([
        {
          id: 'layer-1',
          entry: {
            type: 'conditional',
            conditions: [
              {
                steps: [],
                rules: {
                  operator: 'AND' as const,
                  conditions: [{ field: 'x', operator: 'equals' as const, value: 1 }],
                },
              },
            ],
          },
        },
      ]);
      const next = processorGraphBuilderReducer(state, {
        type: 'UPDATE_CONDITION_RULES',
        layerId: 'layer-1',
        conditionIndex: 0,
        rules: undefined,
      });
      if (next.layers[0]!.entry.type === 'conditional') {
        expect(next.layers[0]!.entry.conditions[0]!.rules).toBeUndefined();
      }
    });
  });

  describe('LOAD_GRAPH', () => {
    it('loads a graph and resets dirty flag', () => {
      const state = makeState();
      const next = processorGraphBuilderReducer(state, {
        type: 'LOAD_GRAPH',
        graph: {
          steps: [
            { type: 'step', step: makeStep() },
            { type: 'parallel', branches: [[{ type: 'step', step: makeStep({ id: 'step-2' }) }]] },
          ],
        },
      });
      expect(next.layers).toHaveLength(2);
      expect(next.isDirty).toBe(false);
    });
  });

  describe('RESET', () => {
    it('resets to empty state', () => {
      const state = makeState([{ id: 'layer-1', entry: { type: 'step', step: makeStep() } }]);
      const next = processorGraphBuilderReducer(state, { type: 'RESET' });
      expect(next.layers).toHaveLength(0);
      expect(next.isDirty).toBe(false);
    });
  });
});
