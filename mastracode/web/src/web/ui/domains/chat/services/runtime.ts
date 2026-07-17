import type { AgentControllerEvent, AgentControllerOMProgress, KnownAgentControllerEvent } from '@mastra/client-js';

export interface UsageSnapshot {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  reasoningTokens?: number;
  [key: string]: unknown;
}

export type OMPhase = 'idle' | 'observing' | 'reflecting' | 'buffering';

export interface GoalSnapshot {
  objective: string;
  status: 'active' | 'paused' | 'done';
  iteration: number;
  maxRuns: number;
  passed: boolean;
  reason?: string;
}

export interface ChatRuntimeState {
  usage?: UsageSnapshot;
  followUpCount: number;
  omProgress?: AgentControllerOMProgress;
  omPhase: OMPhase;
  goal?: GoalSnapshot;
  tokensPerSec: number;
  _decodeStartedAt: number;
}

export const initialChatRuntime: ChatRuntimeState = {
  followUpCount: 0,
  omPhase: 'idle',
  tokensPerSec: 0,
  _decodeStartedAt: 0,
};

export function runtimeReducer(state: ChatRuntimeState, event: AgentControllerEvent): ChatRuntimeState {
  const knownEvent = event as KnownAgentControllerEvent;

  switch (knownEvent.type) {
    case 'agent_start':
      return { ...state, tokensPerSec: 0, _decodeStartedAt: 0 };
    case 'agent_end':
      return { ...state, _decodeStartedAt: 0 };
    case 'message_start':
    case 'message_update':
      if (!hasAssistantText(knownEvent.message) || state._decodeStartedAt > 0) return state;
      return { ...state, _decodeStartedAt: Date.now() };
    case 'usage_update': {
      const usage = knownEvent.usage as UsageSnapshot;
      const stepTokens = (usage.completionTokens ?? 0) + (usage.reasoningTokens ?? 0);
      let tokensPerSec = state.tokensPerSec;
      if (state._decodeStartedAt > 0 && stepTokens > 0) {
        const decodeSeconds = Math.max((Date.now() - state._decodeStartedAt) / 1000, 0.001);
        const instantaneous = stepTokens / decodeSeconds;
        tokensPerSec =
          state.tokensPerSec > 0
            ? Math.round(0.3 * instantaneous + 0.7 * state.tokensPerSec)
            : Math.round(instantaneous);
      }
      return { ...state, usage, tokensPerSec, _decodeStartedAt: 0 };
    }
    case 'display_state_changed':
      return {
        ...state,
        omProgress: knownEvent.displayState.omProgress ?? state.omProgress,
        usage: (knownEvent.displayState.tokenUsage as UsageSnapshot | undefined) ?? state.usage,
      };
    case 'goal_evaluation':
      return {
        ...state,
        goal: {
          objective: knownEvent.payload.objective,
          status: knownEvent.payload.status,
          iteration: knownEvent.payload.iteration,
          maxRuns: knownEvent.payload.maxRuns,
          passed: knownEvent.payload.passed,
          reason: knownEvent.payload.reason,
        },
      };
    case 'follow_up_queued':
      return { ...state, followUpCount: knownEvent.count };
    case 'om_observation_start':
      return { ...state, omPhase: 'observing' };
    case 'om_observation_end':
    case 'om_observation_failed':
    case 'om_reflection_end':
    case 'om_reflection_failed':
    case 'om_buffering_end':
    case 'om_buffering_failed':
      return { ...state, omPhase: 'idle' };
    case 'om_reflection_start':
      return { ...state, omPhase: 'reflecting' };
    case 'om_buffering_start':
      return { ...state, omPhase: 'buffering' };
    case 'om_activation':
      return knownEvent.enabled ? state : { ...state, omPhase: 'idle' };
    default:
      return state;
  }
}

interface RuntimeMessagePart {
  type: string;
  text?: string;
}

interface RuntimeMessage {
  role: string;
  content: RuntimeMessagePart[] | { parts: RuntimeMessagePart[] };
}

function hasAssistantText(message: RuntimeMessage) {
  const parts = Array.isArray(message.content) ? message.content : message.content.parts;
  return message.role === 'assistant' && parts.some(part => part.type === 'text' && part.text?.trim());
}
