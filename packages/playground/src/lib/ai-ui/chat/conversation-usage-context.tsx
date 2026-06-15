import { createContext, useContext } from 'react';

export interface RunUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  cachedInputTokens?: number;
  reasoningTokens?: number;
}

export interface ConversationUsage {
  /**
   * Usage of the most recent LLM step. `inputTokens` is the full prompt sent
   * on that step (system prompt + tools + memory + messages), i.e. the live
   * context occupancy.
   */
  lastStep?: RunUsage;
  /** Totals accumulated across every run of this conversation (this session) */
  cumulative: { inputTokens: number; outputTokens: number; totalTokens: number };
  runCount: number;
}

export const EMPTY_CONVERSATION_USAGE: ConversationUsage = {
  cumulative: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
  runCount: 0,
};

export const ConversationUsageContext = createContext<ConversationUsage>(EMPTY_CONVERSATION_USAGE);

export const useConversationUsage = () => useContext(ConversationUsageContext);

const toFiniteNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

/** Accepts both AI SDK v5 (`inputTokens`) and v4 (`promptTokens`) field names. */
export const normalizeUsage = (usage: unknown): RunUsage | undefined => {
  if (!usage || typeof usage !== 'object') return undefined;
  const u = usage as Record<string, unknown>;
  const inputTokens = toFiniteNumber(u.inputTokens) ?? toFiniteNumber(u.promptTokens);
  const outputTokens = toFiniteNumber(u.outputTokens) ?? toFiniteNumber(u.completionTokens);
  const totalTokens =
    toFiniteNumber(u.totalTokens) ??
    (inputTokens !== undefined || outputTokens !== undefined ? (inputTokens ?? 0) + (outputTokens ?? 0) : undefined);
  if (inputTokens === undefined && outputTokens === undefined && totalTokens === undefined) return undefined;
  return {
    inputTokens,
    outputTokens,
    totalTokens,
    cachedInputTokens: toFiniteNumber(u.cachedInputTokens),
    reasoningTokens: toFiniteNumber(u.reasoningTokens),
  };
};

export interface ChunkUsage {
  /** Per-step usage — its inputTokens is the live context size */
  stepUsage?: RunUsage;
  /** Whole-run usage from the finish chunk — accumulated per conversation */
  finishUsage?: RunUsage;
}

/** Extracts LLM usage from `step-finish` / `finish` stream chunks. */
export const extractChunkUsage = (chunk: unknown): ChunkUsage => {
  const c = chunk as { type?: unknown; payload?: { totalUsage?: unknown; usage?: unknown; output?: { usage?: unknown } } };
  if (c?.type === 'step-finish') {
    return { stepUsage: normalizeUsage(c.payload?.output?.usage ?? c.payload?.usage) };
  }
  if (c?.type === 'finish') {
    return {
      finishUsage: normalizeUsage(c.payload?.totalUsage ?? c.payload?.output?.usage ?? c.payload?.usage),
      stepUsage: normalizeUsage(c.payload?.output?.usage),
    };
  }
  return {};
};
