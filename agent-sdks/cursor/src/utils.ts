import type { AgentExecutionOptionsBase } from '@mastra/core/agent';

/**
 * Same shape as `@internal/agent-sdk-base`'s `SDKAgentRunOptions`, minus
 * `structuredOutput` — the Cursor TypeScript SDK doesn't expose a
 * schema-constrained output API, so this option isn't offered on
 * `CursorSDKAgent` run methods. Redeclared directly (rather than
 * `Omit<SDKAgentRunOptions<OUTPUT>, 'structuredOutput'>`) because `Omit` over
 * a type with a `[key: string]: unknown` index signature collapses the other
 * named properties' specific types back down to the index signature's type.
 */
export type CursorSDKAgentRunOptions<OUTPUT = unknown> = AgentExecutionOptionsBase<OUTPUT> & {
  signal?: AbortSignal;
  [key: string]: unknown;
};
