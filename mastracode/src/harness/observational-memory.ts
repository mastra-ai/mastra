import type { OMProgressState, OMStatus } from '@mastra/core/harness';

export const defaultMastraCodeOMStatus: OMStatus = 'idle';

export function getOMModelState(state: Record<string, unknown>) {
  return {
    observerModelId: typeof state.observerModelId === 'string' ? state.observerModelId : undefined,
    reflectorModelId: typeof state.reflectorModelId === 'string' ? state.reflectorModelId : undefined,
    observationThreshold: typeof state.observationThreshold === 'number' ? state.observationThreshold : undefined,
    reflectionThreshold: typeof state.reflectionThreshold === 'number' ? state.reflectionThreshold : undefined,
  };
}

export function emptyOMProgress(): Partial<OMProgressState> {
  return {
    status: defaultMastraCodeOMStatus,
    buffered: {
      observations: {
        status: 'idle',
        chunks: 0,
        messageTokens: 0,
        projectedMessageRemoval: 0,
        observationTokens: 0,
      },
      reflection: {
        status: 'idle',
        inputObservationTokens: 0,
        observationTokens: 0,
      },
    },
  };
}
