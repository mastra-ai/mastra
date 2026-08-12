import type { AgentControllerEvent, AgentControllerOMProgress, OMStatus } from '@mastra/client-js';
import { isKnownAgentControllerEvent } from '@mastra/client-js';

export interface UsageSnapshot {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  reasoningTokens?: number;
  [key: string]: unknown;
}

export type OMPhase = OMStatus;

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
  /** Reducer-private, kept out of `ChatRuntimeApi`. */
  _sampler: RateSampler;
}

/** The open measurement window: when it opened, and what had been decoded by then. */
interface RateSampler {
  openedAt: number;
  charsAtOpen: number;
  /** Decoded characters per assistant message, so a second message can't read as a rewind. */
  charsByMessage: Record<string, number>;
}

const closedSampler: RateSampler = { openedAt: 0, charsAtOpen: 0, charsByMessage: {} };

const RATE_SAMPLES = 6;
/** Below this a burst reads as network buffering rather than decoding, whatever the arithmetic says. */
const SAMPLE_SECONDS = 0.25;
/** Longer than this and the window spans a tool call or a reconnect, not decoding: reopen it. */
const WINDOW_SECONDS = 3;
/* The stream carries text, not token counts; ~4 chars per token is close enough for a speed readout. */
const CHARS_PER_TOKEN = 4;

export const initialChatRuntime: ChatRuntimeState = {
  followUpCount: 0,
  omPhase: 'idle',
  bufferingMessages: false,
  bufferingObservations: false,
  tokensPerSec: 0,
  tokensPerSecHistory: [],
  _sampler: closedSampler,
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
      return { ...state, tokensPerSec: 0, tokensPerSecHistory: [], _sampler: closedSampler };
    case 'message_start':
    case 'message_update': {
      const chars = decodedChars(event.message);
      if (chars === 0) return state;
      const { openedAt, charsAtOpen } = state._sampler;
      const charsByMessage = { ...state._sampler.charsByMessage, [event.message.id]: chars };
      const decoded = totalChars(charsByMessage);
      const now = Date.now();
      const seconds = (now - openedAt) / 1000;
      if (openedAt === 0 || seconds > WINDOW_SECONDS || decoded <= charsAtOpen) {
        return { ...state, _sampler: { openedAt: now, charsAtOpen: decoded, charsByMessage } };
      }
      if (seconds < SAMPLE_SECONDS) return { ...state, _sampler: { ...state._sampler, charsByMessage } };
      const instantaneous = (decoded - charsAtOpen) / CHARS_PER_TOKEN / seconds;
      const tokensPerSec = Math.round(
        state.tokensPerSec > 0 ? 0.3 * instantaneous + 0.7 * state.tokensPerSec : instantaneous,
      );
      return {
        ...state,
        tokensPerSec,
        tokensPerSecHistory: [...state.tokensPerSecHistory, tokensPerSec].slice(-RATE_SAMPLES),
        _sampler: { openedAt: now, charsAtOpen: decoded, charsByMessage },
      };
    }
    case 'agent_end':
      return { ...state, _sampler: closedSampler };
    case 'usage_update':
      return { ...state, usage: event.usage as UsageSnapshot };
    case 'display_state_changed':
      return {
        ...state,
        omProgress: event.displayState.omProgress ?? state.omProgress,
        /** Sent on every update, so a missed `om_*_end` cannot strand the ring. */
        omPhase: event.displayState.omProgress?.status ?? state.omPhase,
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
  /** Thinking parts carry their stream here, not in `text`. */
  reasoning?: string;
}

interface RuntimeMessage {
  role: string;
  content: RuntimeMessagePart[] | { parts: RuntimeMessagePart[] };
}

function totalChars(charsByMessage: Record<string, number>) {
  return Object.values(charsByMessage).reduce((total, chars) => total + chars, 0);
}

function decodedChars(message: RuntimeMessage) {
  if (message.role !== 'assistant') return 0;
  const parts = Array.isArray(message.content) ? message.content : message.content.parts;
  return parts.reduce((total, part) => total + (part.text?.length ?? 0) + (part.reasoning?.length ?? 0), 0);
}
