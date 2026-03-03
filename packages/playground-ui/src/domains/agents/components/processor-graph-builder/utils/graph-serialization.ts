import { v4 as uuid } from '@lukeed/uuid';

import type { StoredProcessorGraph } from '@mastra/core/storage';

import type { ProcessorGraphBuilderState, BuilderLayer } from '../types';

export function fromStoredProcessorGraph(graph: StoredProcessorGraph): ProcessorGraphBuilderState {
  const layers: BuilderLayer[] = graph.steps.map(entry => ({
    id: uuid(),
    entry,
  }));

  return { layers, isDirty: false };
}

export function toStoredProcessorGraph(state: ProcessorGraphBuilderState): StoredProcessorGraph {
  return {
    steps: state.layers.map(layer => layer.entry),
  };
}
