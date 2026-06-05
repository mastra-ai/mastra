import type { AgentExecutionOptions } from '@mastra/core/agent';

/**
 * Shared model settings applied by every per-step agent in the creation
 * workflow.
 *
 * These step agents do structured, deterministic config authoring (a name, a
 * one-line description, a focused system prompt, etc.) rather than open-ended
 * chat, so a low temperature keeps output stable and on-spec. Centralised here
 * so all step agents stay in lockstep and there is a single place to tune
 * generation behaviour.
 *
 * Applied to each agent via `defaultOptions.modelSettings` so the setting is
 * carried by the agent itself rather than threaded through every call site.
 */
export const AGENT_GENERATION_MODEL_SETTINGS = {
  temperature: 0.2,
} as const satisfies NonNullable<AgentExecutionOptions['modelSettings']>;
