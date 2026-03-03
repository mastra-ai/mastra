import type { ProcessorGraphEntry, ProcessorGraphStep, StoredProcessorGraph, RuleGroup } from '@mastra/core/storage';
import type { ProcessorPhase } from '@mastra/core/processor-provider';

export type { ProcessorGraphEntry, ProcessorGraphStep, StoredProcessorGraph, RuleGroup, ProcessorPhase };

/** Thin wrapper: reuses core ProcessorGraphEntry, adds a stable UI ID for React keys + DnD */
export interface BuilderLayer {
  id: string;
  entry: ProcessorGraphEntry;
}

export type BuilderLayerType = ProcessorGraphEntry['type'];

export interface ProcessorGraphBuilderState {
  layers: BuilderLayer[];
  isDirty: boolean;
}

export interface ValidationError {
  layerId: string;
  field?: string;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

// ============================================================================
// Reducer Actions
// ============================================================================

export type ProcessorGraphBuilderAction =
  | { type: 'ADD_LAYER'; layerType: BuilderLayerType }
  | { type: 'REMOVE_LAYER'; layerId: string }
  | { type: 'REORDER_LAYERS'; sourceIndex: number; destinationIndex: number }
  | { type: 'SET_LAYER_TYPE'; layerId: string; layerType: BuilderLayerType }
  | { type: 'SET_STEP'; layerId: string; step: ProcessorGraphStep }
  | { type: 'UPDATE_STEP_CONFIG'; layerId: string; config: Record<string, unknown> }
  | { type: 'UPDATE_STEP_PHASES'; layerId: string; enabledPhases: ProcessorPhase[] }
  | { type: 'ADD_BRANCH'; layerId: string }
  | { type: 'REMOVE_BRANCH'; layerId: string; branchIndex: number }
  | { type: 'ADD_STEP_TO_BRANCH'; layerId: string; branchIndex: number; step: ProcessorGraphStep }
  | { type: 'REMOVE_STEP_FROM_BRANCH'; layerId: string; branchIndex: number; stepIndex: number }
  | {
      type: 'UPDATE_BRANCH_STEP_CONFIG';
      layerId: string;
      branchIndex: number;
      stepIndex: number;
      config: Record<string, unknown>;
    }
  | {
      type: 'UPDATE_BRANCH_STEP_PHASES';
      layerId: string;
      branchIndex: number;
      stepIndex: number;
      enabledPhases: ProcessorPhase[];
    }
  | { type: 'ADD_STEP_TO_CONDITION'; layerId: string; conditionIndex: number; step: ProcessorGraphStep }
  | { type: 'REMOVE_STEP_FROM_CONDITION'; layerId: string; conditionIndex: number; stepIndex: number }
  | { type: 'ADD_CONDITION'; layerId: string }
  | { type: 'REMOVE_CONDITION'; layerId: string; conditionIndex: number }
  | { type: 'UPDATE_CONDITION_RULES'; layerId: string; conditionIndex: number; rules: RuleGroup | undefined }
  | {
      type: 'UPDATE_CONDITION_STEP_CONFIG';
      layerId: string;
      conditionIndex: number;
      stepIndex: number;
      config: Record<string, unknown>;
    }
  | {
      type: 'UPDATE_CONDITION_STEP_PHASES';
      layerId: string;
      conditionIndex: number;
      stepIndex: number;
      enabledPhases: ProcessorPhase[];
    }
  | { type: 'LOAD_GRAPH'; graph: StoredProcessorGraph }
  | { type: 'RESET' };
