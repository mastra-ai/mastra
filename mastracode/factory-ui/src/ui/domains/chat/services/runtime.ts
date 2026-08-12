import type { AgentControllerEvent, AgentControllerOMProgress } from '@mastra/client-js';
import { isKnownAgentControllerEvent } from '@mastra/client-js';

export interface UsageSnapshot {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  reasoningTokens?: number;
  [key: string]: unknown;
}

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
  usage?: UsageSnapshot;
  followUpCount: number;
  omProgress?: AgentControllerOMProgress;
  omPhase: OMPhase;
  bufferingMessages: boolean;
  bufferingObservations: boolean;
  goal?: GoalSnapshot;
  tokensPerSec: number;
  /** Recent decode rates of this run, oldest first, for the throughput curve. */
  tokensPerSecHistory: number[];
  /** Start of the open measurement window, 0 when no run is streaming. */
  _sampledAt: number;
  _streamedChars: number;
}

const RATE_SAMPLES = 12;
const SAMPLE_SECONDS = 0.25;
/* The stream carries text, not token counts; ~4 chars per token is close enough for a speed readout. */
const CHARS_PER_TOKEN = 4;

export const initialChatRuntime: ChatRuntimeState = {
  followUpCount: 0,
  omPhase: 'idle',
  bufferingMessages: false,
  bufferingObservations: false,
  tokensPerSec: 0,
  tokensPerSecHistory: [],
  _sampledAt: 0,
  _streamedChars: 0,
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
      return { ...state, tokensPerSec: 0, tokensPerSecHistory: [], _sampledAt: Date.now(), _streamedChars: 0 };
    case 'agent_end':
      return { ...state, tokensPerSec: 0, tokensPerSecHistory: [], _sampledAt: 0, _streamedChars: 0 };
    case 'message_start':
    case 'message_update': {
      if (state._sampledAt === 0) return state;
      const chars = decodedChars(event.message);
      if (chars === 0) return state;
      // A first text, or a shorter one than the last sample, is a new message: open a window instead of measuring one.
      if (state._streamedChars === 0 || chars < state._streamedChars) {
        return { ...state, _sampledAt: Date.now(), _streamedChars: chars };
      }
      const seconds = (Date.now() - state._sampledAt) / 1000;
      if (chars === state._streamedChars || seconds < SAMPLE_SECONDS) return state;
      const instantaneous = (chars - state._streamedChars) / CHARS_PER_TOKEN / seconds;
      const tokensPerSec = Math.round(
        state.tokensPerSec > 0 ? 0.3 * instantaneous + 0.7 * state.tokensPerSec : instantaneous,
      );
      return {
        ...state,
        tokensPerSec,
        tokensPerSecHistory: [...state.tokensPerSecHistory, tokensPerSec].slice(-RATE_SAMPLES),
        _sampledAt: Date.now(),
        _streamedChars: chars,
      };
    }
    case 'usage_update':
      return { ...state, usage: event.usage as UsageSnapshot };
    case 'display_state_changed':
      return {
        ...state,
        omProgress: event.displayState.omProgress ?? state.omProgress,
        usage: (event.displayState.tokenUsage as UsageSnapshot | undefined) ?? state.usage,
        bufferingMessages: event.displayState.bufferingMessages ?? state.bufferingMessages,
        bufferingObservations: event.displayState.bufferingObservations ?? state.bufferingObservations,
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
      return { ...state, omPhase: 'idle' };
    case 'om_reflection_start':
      return { ...state, omPhase: 'reflecting' };
    case 'om_activation':
      return event.enabled ? state : { ...state, omPhase: 'idle' };
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

function decodedChars(message: RuntimeMessage) {
  if (message.role !== 'assistant') return 0;
  const parts = Array.isArray(message.content) ? message.content : message.content.parts;
  return parts.reduce((total, part) => total + (part.text?.length ?? 0), 0);
}
