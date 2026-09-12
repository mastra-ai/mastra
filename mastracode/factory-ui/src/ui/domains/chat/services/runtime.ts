import type { AgentControllerEvent } from '@mastra/client-js';
import { isKnownAgentControllerEvent } from '@mastra/client-js';
import type { MastraDBMessage, TokenUsage } from '@mastra/core/agent-controller';

import type { OMBudgets } from './om';

export type OMPhase = OMBudgets['status'];
export type GoalSnapshot = Pick<
  Extract<AgentControllerEvent, { type: 'goal_evaluation' }>['payload'],
  'objective' | 'status' | 'iteration' | 'maxRuns' | 'passed' | 'reason'
>;

export interface ChatRuntimeState {
  usage?: TokenUsage;
  followUpCount: number;
  omProgress?: OMBudgets;
  omPhase: OMPhase;
  bufferingMessages: boolean;
  bufferingObservations: boolean;
  goal?: GoalSnapshot;
  tokensPerSec: number;
  _decodeStartedAt: number;
}

export const initialChatRuntime: ChatRuntimeState = {
  followUpCount: 0,
  omPhase: 'idle',
  bufferingMessages: false,
  bufferingObservations: false,
  tokensPerSec: 0,
  _decodeStartedAt: 0,
};

type RuntimeAction = { type: 'event'; event: AgentControllerEvent } | { type: 'reset' };

export function runtimeReducer(state: ChatRuntimeState, action: RuntimeAction): ChatRuntimeState {
  if (action.type === 'reset') return initialChatRuntime;

  const event = action.event;
  if (!isKnownAgentControllerEvent(event)) return state;

  switch (event.type) {
    case 'agent_start':
      return { ...state, tokensPerSec: 0, _decodeStartedAt: 0 };
    case 'agent_end':
      return { ...state, _decodeStartedAt: 0 };
    case 'message_start':
    case 'message_update':
      if (!hasAssistantText(event.message) || state._decodeStartedAt > 0) return state;
      return { ...state, _decodeStartedAt: Date.now() };
    case 'usage_update': {
      const usage = event.usage;
      const stepTokens = usage.completionTokens + (usage.reasoningTokens ?? 0);
      let tokensPerSec = state.tokensPerSec;
      if (state._decodeStartedAt > 0 && stepTokens > 0) {
        const decodeSeconds = Math.max((Date.now() - state._decodeStartedAt) / 1000, 0.001);
        const instantaneous = stepTokens / decodeSeconds;
        tokensPerSec =
          state.tokensPerSec > 0
            ? Math.round(0.3 * instantaneous + 0.7 * state.tokensPerSec)
            : Math.round(instantaneous);
      }
      return { ...state, tokensPerSec, _decodeStartedAt: 0 };
    }
    case 'display_state_changed':
      return {
        ...state,
        omProgress: event.displayState.omProgress ?? state.omProgress,
        usage: event.displayState.tokenUsage ?? state.usage,
        followUpCount: event.displayState.queuedFollowUps ?? state.followUpCount,
        omPhase: event.displayState.omProgress?.status ?? state.omPhase,
        bufferingMessages: event.displayState.bufferingMessages ?? false,
        bufferingObservations: event.displayState.bufferingObservations ?? false,
      };
    case 'goal_evaluation':
      return { ...state, goal: event.payload };
    default:
      return state;
  }
}

function hasAssistantText(message: MastraDBMessage) {
  return message.role === 'assistant' && message.content.parts.some(part => part.type === 'text' && part.text.trim());
}
