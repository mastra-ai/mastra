import type { AgentExecutionOptions } from '@mastra/core/agent';
import type { StorageModelConfig, StorageVisibility } from '@mastra/core/storage';

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

/**
 * Default visibility for an agent created through this workflow. Mirrors the
 * playground starter, which persists new agents as `private` (via
 * `useDefaultVisibility`, defaulting to `'private'`).
 */
export const DEFAULT_VISIBILITY: StorageVisibility = 'private';

/**
 * Last-resort model used when the workflow cannot resolve any model the builder
 * policy accepts. Ported verbatim from the playground starter's `FALLBACK_MODEL`
 * so the workflow always persists *some* model (the snapshot requires it).
 */
export const FALLBACK_MODEL: StorageModelConfig = { provider: 'google', name: 'gemini-2.5-flash' };

/**
 * Default request-context schema attached to every agent created through the
 * builder. Describes a single `user` request-context variable mirroring the
 * playground's `DEFAULT_BUILDER_REQUEST_CONTEXT_SCHEMA`. Set once at create-time
 * and never touched afterwards, so later edits don't clobber user schemas.
 */
export const DEFAULT_BUILDER_REQUEST_CONTEXT_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    user: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        email: { type: 'string' },
        name: { type: 'string' },
        avatarUrl: { type: 'string' },
        roles: { type: 'array', items: { type: 'string' } },
        permissions: { type: 'array', items: { type: 'string' } },
      },
      required: ['id'],
    },
    required: ['user'],
  },
};
