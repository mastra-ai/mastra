import { useCallback, useMemo, useReducer } from 'react';
import { v4 as uuid } from '@lukeed/uuid';

import type { StoredProcessorGraph, ProcessorGraphEntryDepth2, ProcessorGraphEntryDepth3 } from '@mastra/core/storage';

import type {
  ProcessorGraphBuilderState,
  ProcessorGraphBuilderAction,
  BuilderLayer,
  BuilderLayerType,
  ProcessorGraphStep,
  ProcessorPhase,
  RuleGroup,
} from '../types';
import { fromStoredProcessorGraph, toStoredProcessorGraph } from '../utils/graph-serialization';
import { validateGraph } from '../utils/graph-validation';

function createEmptyStep(): ProcessorGraphStep {
  return { id: uuid(), providerId: '', config: {}, enabledPhases: [] };
}

function createEmptyLayer(layerType: BuilderLayerType): BuilderLayer {
  switch (layerType) {
    case 'step':
      return { id: uuid(), entry: { type: 'step', step: createEmptyStep() } };
    case 'parallel':
      return { id: uuid(), entry: { type: 'parallel', branches: [[]] } };
    case 'conditional':
      return { id: uuid(), entry: { type: 'conditional', conditions: [{ steps: [] }] } };
  }
}

function reorder<T>(list: T[], startIndex: number, endIndex: number): T[] {
  const result = Array.from(list);
  const [removed] = result.splice(startIndex, 1);
  result.splice(endIndex, 0, removed!);
  return result;
}

export function processorGraphBuilderReducer(
  state: ProcessorGraphBuilderState,
  action: ProcessorGraphBuilderAction,
): ProcessorGraphBuilderState {
  switch (action.type) {
    case 'ADD_LAYER': {
      return {
        ...state,
        layers: [...state.layers, createEmptyLayer(action.layerType)],
        isDirty: true,
      };
    }

    case 'REMOVE_LAYER': {
      return {
        ...state,
        layers: state.layers.filter(l => l.id !== action.layerId),
        isDirty: true,
      };
    }

    case 'REORDER_LAYERS': {
      return {
        ...state,
        layers: reorder(state.layers, action.sourceIndex, action.destinationIndex),
        isDirty: true,
      };
    }

    case 'SET_LAYER_TYPE': {
      return {
        ...state,
        layers: state.layers.map(l => {
          if (l.id !== action.layerId) return l;
          const newLayer = createEmptyLayer(action.layerType);
          return { ...newLayer, id: l.id };
        }),
        isDirty: true,
      };
    }

    case 'SET_STEP': {
      return {
        ...state,
        layers: state.layers.map(l => {
          if (l.id !== action.layerId || l.entry.type !== 'step') return l;
          return { ...l, entry: { type: 'step' as const, step: action.step } };
        }),
        isDirty: true,
      };
    }

    case 'UPDATE_STEP_CONFIG': {
      return {
        ...state,
        layers: state.layers.map(l => {
          if (l.id !== action.layerId || l.entry.type !== 'step') return l;
          return { ...l, entry: { type: 'step' as const, step: { ...l.entry.step, config: action.config } } };
        }),
        isDirty: true,
      };
    }

    case 'UPDATE_STEP_PHASES': {
      return {
        ...state,
        layers: state.layers.map(l => {
          if (l.id !== action.layerId || l.entry.type !== 'step') return l;
          return {
            ...l,
            entry: { type: 'step' as const, step: { ...l.entry.step, enabledPhases: action.enabledPhases } },
          };
        }),
        isDirty: true,
      };
    }

    case 'ADD_BRANCH': {
      return {
        ...state,
        layers: state.layers.map(l => {
          if (l.id !== action.layerId || l.entry.type !== 'parallel') return l;
          return { ...l, entry: { type: 'parallel' as const, branches: [...l.entry.branches, []] } };
        }),
        isDirty: true,
      };
    }

    case 'REMOVE_BRANCH': {
      return {
        ...state,
        layers: state.layers.map(l => {
          if (l.id !== action.layerId || l.entry.type !== 'parallel') return l;
          return {
            ...l,
            entry: {
              type: 'parallel' as const,
              branches: l.entry.branches.filter((_, i) => i !== action.branchIndex),
            },
          };
        }),
        isDirty: true,
      };
    }

    case 'ADD_STEP_TO_BRANCH': {
      return {
        ...state,
        layers: state.layers.map(l => {
          if (l.id !== action.layerId || l.entry.type !== 'parallel') return l;
          const branches = l.entry.branches.map((branch, i) => {
            if (i !== action.branchIndex) return branch;
            const newEntry: ProcessorGraphEntryDepth3 = { type: 'step', step: action.step };
            return [...branch, newEntry];
          });
          return { ...l, entry: { type: 'parallel' as const, branches } };
        }),
        isDirty: true,
      };
    }

    case 'REMOVE_STEP_FROM_BRANCH': {
      return {
        ...state,
        layers: state.layers.map(l => {
          if (l.id !== action.layerId || l.entry.type !== 'parallel') return l;
          const branches = l.entry.branches.map((branch, i) => {
            if (i !== action.branchIndex) return branch;
            return branch.filter((_, si) => si !== action.stepIndex);
          });
          return { ...l, entry: { type: 'parallel' as const, branches } };
        }),
        isDirty: true,
      };
    }

    case 'UPDATE_BRANCH_STEP_CONFIG': {
      return {
        ...state,
        layers: state.layers.map(l => {
          if (l.id !== action.layerId || l.entry.type !== 'parallel') return l;
          const branches = l.entry.branches.map((branch, bi) => {
            if (bi !== action.branchIndex) return branch;
            return branch.map((entry, si) => {
              if (si !== action.stepIndex || entry.type !== 'step') return entry;
              return { type: 'step' as const, step: { ...entry.step, config: action.config } };
            });
          });
          return { ...l, entry: { type: 'parallel' as const, branches } };
        }),
        isDirty: true,
      };
    }

    case 'UPDATE_BRANCH_STEP_PHASES': {
      return {
        ...state,
        layers: state.layers.map(l => {
          if (l.id !== action.layerId || l.entry.type !== 'parallel') return l;
          const branches = l.entry.branches.map((branch, bi) => {
            if (bi !== action.branchIndex) return branch;
            return branch.map((entry, si) => {
              if (si !== action.stepIndex || entry.type !== 'step') return entry;
              return { type: 'step' as const, step: { ...entry.step, enabledPhases: action.enabledPhases } };
            });
          });
          return { ...l, entry: { type: 'parallel' as const, branches } };
        }),
        isDirty: true,
      };
    }

    case 'ADD_STEP_TO_CONDITION': {
      return {
        ...state,
        layers: state.layers.map(l => {
          if (l.id !== action.layerId || l.entry.type !== 'conditional') return l;
          const conditions = l.entry.conditions.map((cond, i) => {
            if (i !== action.conditionIndex) return cond;
            const newEntry: ProcessorGraphEntryDepth2 = { type: 'step', step: action.step };
            return { ...cond, steps: [...cond.steps, newEntry] };
          });
          return { ...l, entry: { type: 'conditional' as const, conditions } };
        }),
        isDirty: true,
      };
    }

    case 'REMOVE_STEP_FROM_CONDITION': {
      return {
        ...state,
        layers: state.layers.map(l => {
          if (l.id !== action.layerId || l.entry.type !== 'conditional') return l;
          const conditions = l.entry.conditions.map((cond, i) => {
            if (i !== action.conditionIndex) return cond;
            return { ...cond, steps: cond.steps.filter((_, si) => si !== action.stepIndex) };
          });
          return { ...l, entry: { type: 'conditional' as const, conditions } };
        }),
        isDirty: true,
      };
    }

    case 'ADD_CONDITION': {
      return {
        ...state,
        layers: state.layers.map(l => {
          if (l.id !== action.layerId || l.entry.type !== 'conditional') return l;
          return {
            ...l,
            entry: { type: 'conditional' as const, conditions: [...l.entry.conditions, { steps: [] }] },
          };
        }),
        isDirty: true,
      };
    }

    case 'REMOVE_CONDITION': {
      return {
        ...state,
        layers: state.layers.map(l => {
          if (l.id !== action.layerId || l.entry.type !== 'conditional') return l;
          return {
            ...l,
            entry: {
              type: 'conditional' as const,
              conditions: l.entry.conditions.filter((_, i) => i !== action.conditionIndex),
            },
          };
        }),
        isDirty: true,
      };
    }

    case 'UPDATE_CONDITION_RULES': {
      return {
        ...state,
        layers: state.layers.map(l => {
          if (l.id !== action.layerId || l.entry.type !== 'conditional') return l;
          const conditions = l.entry.conditions.map((cond, i) => {
            if (i !== action.conditionIndex) return cond;
            return { ...cond, rules: action.rules };
          });
          return { ...l, entry: { type: 'conditional' as const, conditions } };
        }),
        isDirty: true,
      };
    }

    case 'UPDATE_CONDITION_STEP_CONFIG': {
      return {
        ...state,
        layers: state.layers.map(l => {
          if (l.id !== action.layerId || l.entry.type !== 'conditional') return l;
          const conditions = l.entry.conditions.map((cond, ci) => {
            if (ci !== action.conditionIndex) return cond;
            return {
              ...cond,
              steps: cond.steps.map((entry, si) => {
                if (si !== action.stepIndex || entry.type !== 'step') return entry;
                return { type: 'step' as const, step: { ...entry.step, config: action.config } };
              }),
            };
          });
          return { ...l, entry: { type: 'conditional' as const, conditions } };
        }),
        isDirty: true,
      };
    }

    case 'UPDATE_CONDITION_STEP_PHASES': {
      return {
        ...state,
        layers: state.layers.map(l => {
          if (l.id !== action.layerId || l.entry.type !== 'conditional') return l;
          const conditions = l.entry.conditions.map((cond, ci) => {
            if (ci !== action.conditionIndex) return cond;
            return {
              ...cond,
              steps: cond.steps.map((entry, si) => {
                if (si !== action.stepIndex || entry.type !== 'step') return entry;
                return { type: 'step' as const, step: { ...entry.step, enabledPhases: action.enabledPhases } };
              }),
            };
          });
          return { ...l, entry: { type: 'conditional' as const, conditions } };
        }),
        isDirty: true,
      };
    }

    case 'LOAD_GRAPH': {
      return fromStoredProcessorGraph(action.graph);
    }

    case 'RESET': {
      return { layers: [], isDirty: false };
    }

    default:
      return state;
  }
}

const INITIAL_STATE: ProcessorGraphBuilderState = { layers: [], isDirty: false };

export function useProcessorGraphBuilder(initialGraph?: StoredProcessorGraph) {
  const initial = initialGraph ? fromStoredProcessorGraph(initialGraph) : INITIAL_STATE;
  const [state, dispatch] = useReducer(processorGraphBuilderReducer, initial);

  const addLayer = useCallback((layerType: BuilderLayerType) => dispatch({ type: 'ADD_LAYER', layerType }), []);

  const removeLayer = useCallback((layerId: string) => dispatch({ type: 'REMOVE_LAYER', layerId }), []);

  const reorderLayers = useCallback(
    (sourceIndex: number, destinationIndex: number) =>
      dispatch({ type: 'REORDER_LAYERS', sourceIndex, destinationIndex }),
    [],
  );

  const setLayerType = useCallback(
    (layerId: string, layerType: BuilderLayerType) => dispatch({ type: 'SET_LAYER_TYPE', layerId, layerType }),
    [],
  );

  const setStep = useCallback(
    (layerId: string, step: ProcessorGraphStep) => dispatch({ type: 'SET_STEP', layerId, step }),
    [],
  );

  const updateStepConfig = useCallback(
    (layerId: string, config: Record<string, unknown>) => dispatch({ type: 'UPDATE_STEP_CONFIG', layerId, config }),
    [],
  );

  const updateStepPhases = useCallback(
    (layerId: string, enabledPhases: ProcessorPhase[]) =>
      dispatch({ type: 'UPDATE_STEP_PHASES', layerId, enabledPhases }),
    [],
  );

  const addBranch = useCallback((layerId: string) => dispatch({ type: 'ADD_BRANCH', layerId }), []);

  const removeBranch = useCallback(
    (layerId: string, branchIndex: number) => dispatch({ type: 'REMOVE_BRANCH', layerId, branchIndex }),
    [],
  );

  const addStepToBranch = useCallback(
    (layerId: string, branchIndex: number, step: ProcessorGraphStep) =>
      dispatch({ type: 'ADD_STEP_TO_BRANCH', layerId, branchIndex, step }),
    [],
  );

  const removeStepFromBranch = useCallback(
    (layerId: string, branchIndex: number, stepIndex: number) =>
      dispatch({ type: 'REMOVE_STEP_FROM_BRANCH', layerId, branchIndex, stepIndex }),
    [],
  );

  const updateBranchStepConfig = useCallback(
    (layerId: string, branchIndex: number, stepIndex: number, config: Record<string, unknown>) =>
      dispatch({ type: 'UPDATE_BRANCH_STEP_CONFIG', layerId, branchIndex, stepIndex, config }),
    [],
  );

  const updateBranchStepPhases = useCallback(
    (layerId: string, branchIndex: number, stepIndex: number, enabledPhases: ProcessorPhase[]) =>
      dispatch({ type: 'UPDATE_BRANCH_STEP_PHASES', layerId, branchIndex, stepIndex, enabledPhases }),
    [],
  );

  const addStepToCondition = useCallback(
    (layerId: string, conditionIndex: number, step: ProcessorGraphStep) =>
      dispatch({ type: 'ADD_STEP_TO_CONDITION', layerId, conditionIndex, step }),
    [],
  );

  const removeStepFromCondition = useCallback(
    (layerId: string, conditionIndex: number, stepIndex: number) =>
      dispatch({ type: 'REMOVE_STEP_FROM_CONDITION', layerId, conditionIndex, stepIndex }),
    [],
  );

  const addCondition = useCallback((layerId: string) => dispatch({ type: 'ADD_CONDITION', layerId }), []);

  const removeCondition = useCallback(
    (layerId: string, conditionIndex: number) => dispatch({ type: 'REMOVE_CONDITION', layerId, conditionIndex }),
    [],
  );

  const updateConditionStepConfig = useCallback(
    (layerId: string, conditionIndex: number, stepIndex: number, config: Record<string, unknown>) =>
      dispatch({ type: 'UPDATE_CONDITION_STEP_CONFIG', layerId, conditionIndex, stepIndex, config }),
    [],
  );

  const updateConditionStepPhases = useCallback(
    (layerId: string, conditionIndex: number, stepIndex: number, enabledPhases: ProcessorPhase[]) =>
      dispatch({ type: 'UPDATE_CONDITION_STEP_PHASES', layerId, conditionIndex, stepIndex, enabledPhases }),
    [],
  );

  const updateConditionRules = useCallback(
    (layerId: string, conditionIndex: number, rules: RuleGroup | undefined) =>
      dispatch({ type: 'UPDATE_CONDITION_RULES', layerId, conditionIndex, rules }),
    [],
  );

  const loadGraph = useCallback((graph: StoredProcessorGraph) => dispatch({ type: 'LOAD_GRAPH', graph }), []);

  const reset = useCallback(() => dispatch({ type: 'RESET' }), []);

  const toGraph = useCallback(() => toStoredProcessorGraph(state), [state]);

  const validation = useMemo(() => validateGraph(state), [state]);

  return {
    state,
    dispatch,
    addLayer,
    removeLayer,
    reorderLayers,
    setLayerType,
    setStep,
    updateStepConfig,
    updateStepPhases,
    addBranch,
    removeBranch,
    addStepToBranch,
    removeStepFromBranch,
    updateBranchStepConfig,
    updateBranchStepPhases,
    addStepToCondition,
    removeStepFromCondition,
    addCondition,
    removeCondition,
    updateConditionStepConfig,
    updateConditionStepPhases,
    updateConditionRules,
    loadGraph,
    reset,
    toGraph,
    validation,
  };
}

export type ProcessorGraphBuilderAPI = ReturnType<typeof useProcessorGraphBuilder>;
