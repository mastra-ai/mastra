import type { AgentControllerOMProgress } from '@mastra/client-js';

import type { ChatRuntimeState } from './runtime';

export type OMBudgets = Pick<
  AgentControllerOMProgress,
  | 'status'
  | 'pendingTokens'
  | 'threshold'
  | 'thresholdPercent'
  | 'observationTokens'
  | 'reflectionThreshold'
  | 'reflectionThresholdPercent'
>;

export type OMWork = 'idle' | 'background' | 'blocking';

export interface OMWorkByBudget {
  messages: OMWork;
  observations: OMWork;
}

function budgetWork(buffering: boolean, blocking: boolean): OMWork {
  if (buffering) return 'background';
  return blocking ? 'blocking' : 'idle';
}

export function omWork(
  state: Pick<ChatRuntimeState, 'omPhase' | 'bufferingMessages' | 'bufferingObservations'>,
): OMWorkByBudget {
  return {
    messages: budgetWork(state.bufferingMessages, state.omPhase === 'observing'),
    observations: budgetWork(state.bufferingObservations, state.omPhase === 'reflecting'),
  };
}
