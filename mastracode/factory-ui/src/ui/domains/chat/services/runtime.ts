import type { AgentControllerEvent, AgentControllerOMProgress } from '@mastra/client-js';
import { isKnownAgentControllerEvent } from '@mastra/client-js';
import type { TokenUsage } from '@mastra/core/agent-controller';

/**
 * The memory budgets the status line reads. Two sources feed them and only
 * agree on these fields: the session-state route (which also derives projected
 * savings) and the `display_state_changed` snapshot (which also carries the
 * buffering internals).
 */
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

export type OMPhase = 'idle' | 'observing' | 'reflecting';

/** Memory work on one budget: none, in the background, or with the turn on hold. */
export type OMWork = 'idle' | 'background' | 'blocking';

export interface GoalSnapshot {
  objective: string;
  status: 'active' | 'paused' | 'done';
  iteration: number;
  maxRuns: number;
  passed: boolean;
  reason?: string;
}

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

export interface OMWorkByBudget {
  messages: OMWork;
  observations: OMWork;
}

function budgetWork(buffering: boolean, blocking: boolean): OMWork {
  if (buffering) return 'background';
  return blocking ? 'blocking' : 'idle';
}

/** Buffering is level-triggered from the display state, so it outranks the start events a background retry also emits. */
export function omWork(
  state: Pick<ChatRuntimeState, 'omPhase' | 'bufferingMessages' | 'bufferingObservations'>,
): OMWorkByBudget {
  return {
    messages: budgetWork(state.bufferingMessages, state.omPhase === 'observing'),
    observations: budgetWork(state.bufferingObservations, state.omPhase === 'reflecting'),
  };
}

export function runtimeReducer(state: ChatRuntimeState, event: AgentControllerEvent): ChatRuntimeState {
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
      return { ...state, usage, tokensPerSec, _decodeStartedAt: 0 };
    }
    case 'display_state_changed':
      return {
        ...state,
        omProgress: event.displayState.omProgress,
        usage: event.displayState.tokenUsage,
        bufferingMessages: event.displayState.bufferingMessages,
        bufferingObservations: event.displayState.bufferingObservations,
      };
    case 'goal_evaluation':
      return {
        ...state,
        goal: {
          objective: event.payload.objective,
          status: event.payload.status,
          iteration: event.payload.iteration,
          maxRuns: event.payload.maxRuns,
          passed: event.payload.passed,
          reason: event.payload.reason,
        },
      };
    case 'follow_up_queued':
      return { ...state, followUpCount: event.count };
    case 'om_observation_start':
      return { ...state, omPhase: 'observing' };
    case 'om_observation_end':
    case 'om_observation_failed':
    case 'om_reflection_end':
    case 'om_reflection_failed':
    case 'om_activation':
      return { ...state, omPhase: 'idle' };
    case 'om_reflection_start':
      return { ...state, omPhase: 'reflecting' };
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
