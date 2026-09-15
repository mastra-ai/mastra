import { agentConfig } from '@mastra/core/agent';

/**
 * Nested subagent: `historian` (depth 2).
 *
 * Subagents can declare their own `subagents/` up to `MAX_FS_SUBAGENT_DEPTH`
 * levels below the top-level agent. This one is wired into `forecaster` as a
 * delegation tool named `historian`, so the chain is:
 * `weather-fs` -> `forecaster` -> `historian`.
 *
 * Like any subagent, its `config.ts` MUST set a non-empty `description`.
 */
export default agentConfig({
  model: 'openai/gpt-5.4-mini',
  description: 'Looks up historical climate normals (typical temperatures and rainfall) for a city and month.',
  // instructions omitted -> taken from instructions.md
  // tools omitted -> taken from tools/*.ts
});
