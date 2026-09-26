import type { AgentControllerEvent, AgentControllerSessionState } from '@mastra/client-js';
import { isKnownAgentControllerEvent } from '@mastra/client-js';
import type { TokenUsage } from '@mastra/core/agent-controller';

import type { OMBudgets } from './om';

export type SessionStateSnapshot = Pick<AgentControllerSessionState, 'threadId' | 'omProgress' | 'tokenUsage'>;
export type OMPhase = 'idle' | 'observing' | 'reflecting' | 'buffering';
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
  /** Assistant message the decode window measures; a different message starts a new window. */
  _decodeMessageId?: string;
  _decodeStartedAt: number;
  _decodeLastDeltaAt: number;
  _decodeHasReasoning: boolean;
}

export const initialChatRuntime: ChatRuntimeState = {
  followUpCount: 0,
  omPhase: 'idle',
  bufferingMessages: false,
  bufferingObservations: false,
  tokensPerSec: 0,
  _decodeStartedAt: 0,
  _decodeLastDeltaAt: 0,
  _decodeHasReasoning: false,
};

type RuntimeAction =
  | { type: 'event'; event: AgentControllerEvent }
  | { type: 'reset'; threadId?: string; state?: SessionStateSnapshot };

export function runtimeReducer(state: ChatRuntimeState, action: RuntimeAction): ChatRuntimeState {
  if (action.type === 'reset') {
    const matchingSnapshot =
      action.threadId !== undefined && action.state?.threadId === action.threadId ? action.state : undefined;
    return { ...initialChatRuntime, usage: matchingSnapshot?.tokenUsage, omProgress: matchingSnapshot?.omProgress };
  }

  const event = action.event;
  if (!isKnownAgentControllerEvent(event)) return state;

  switch (event.type) {
    case 'agent_start':
      return {
        ...state,
        tokensPerSec: 0,
        _decodeMessageId: undefined,
        _decodeStartedAt: 0,
        _decodeLastDeltaAt: 0,
        _decodeHasReasoning: false,
      };
    case 'agent_end':
      return {
        ...state,
        _decodeMessageId: undefined,
        _decodeStartedAt: 0,
        _decodeLastDeltaAt: 0,
        _decodeHasReasoning: false,
      };
    case 'message_update':
      if (
        (event.event.type === 'text-delta' || event.event.type === 'reasoning-delta') &&
        event.event.delta.length > 0
      ) {
        const now = Date.now();
        // The window is bound to the assistant message, so a step whose usage never
        // arrived cannot leave its interval open over the next step's tool execution.
        const startsWindow = state._decodeMessageId !== event.id;
        return {
          ...state,
          _decodeMessageId: event.id,
          _decodeStartedAt: startsWindow ? now : state._decodeStartedAt,
          _decodeLastDeltaAt: now,
          _decodeHasReasoning: startsWindow
            ? event.event.type === 'reasoning-delta'
            : state._decodeHasReasoning || event.event.type === 'reasoning-delta',
        };
      }
      return state;
    case 'tool_input_delta':
      if (typeof event.argsTextDelta === 'string' && event.argsTextDelta.length > 0) {
        const now = Date.now();
        // Arguments stream before this step's message_start, so the stamped id is what
        // attributes them to a step. Unstamped (older server) keeps the existing window.
        if (event.messageId !== undefined && state._decodeMessageId !== event.messageId) {
          return {
            ...state,
            _decodeMessageId: event.messageId,
            _decodeStartedAt: now,
            _decodeLastDeltaAt: now,
            _decodeHasReasoning: false,
          };
        }
        return { ...state, _decodeStartedAt: state._decodeStartedAt || now, _decodeLastDeltaAt: now };
      }
      return state;
    case 'usage_update': {
      const usage = event.usage;
      // Provider output already includes reasoning. Buffered delivery can still spike,
      // but initial waiting and subsequent tool execution are not decode time.
      const reportedReasoning = usage.reasoningTokens ?? 0;
      // Thinking that never streamed has no observable duration, so measure the output
      // we did see rather than dividing hidden tokens by a text-only window.
      const stepTokens =
        reportedReasoning > 0 && !state._decodeHasReasoning
          ? usage.completionTokens - reportedReasoning
          : usage.completionTokens;
      const decodeSeconds = (state._decodeLastDeltaAt - state._decodeStartedAt) / 1000;
      let tokensPerSec = state.tokensPerSec;
      if (state._decodeStartedAt > 0 && decodeSeconds > 0 && stepTokens > 0) {
        const instantaneous = stepTokens / decodeSeconds;
        tokensPerSec =
          state.tokensPerSec > 0
            ? Math.round(0.3 * instantaneous + 0.7 * state.tokensPerSec)
            : Math.round(instantaneous);
      }
      return {
        ...state,
        usage,
        tokensPerSec,
        _decodeMessageId: undefined,
        _decodeStartedAt: 0,
        _decodeLastDeltaAt: 0,
        _decodeHasReasoning: false,
      };
    }
    case 'display_state_changed':
      return {
        ...state,
        omProgress: event.displayState.omProgress ?? state.omProgress,
        usage: event.displayState.tokenUsage ?? state.usage,
        bufferingMessages: event.displayState.bufferingMessages ?? false,
        bufferingObservations: event.displayState.bufferingObservations ?? false,
      };
    case 'goal_evaluation':
      return { ...state, goal: event.payload };
    case 'follow_up_queued':
      return { ...state, followUpCount: event.count };
    case 'om_observation_start':
      return { ...state, omPhase: 'observing' };
    case 'om_reflection_start':
      return { ...state, omPhase: 'reflecting' };
    case 'om_buffering_start':
      return { ...state, omPhase: 'buffering' };
    case 'om_observation_end':
    case 'om_observation_failed':
    case 'om_reflection_end':
    case 'om_reflection_failed':
    case 'om_buffering_end':
    case 'om_buffering_failed':
    case 'om_activation':
      return { ...state, omPhase: 'idle' };
    default:
      return state;
  }
}
