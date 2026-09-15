import { agentConfig } from '@mastra/core/agent';

/**
 * Declared subagent: `forecaster`.
 *
 * A subagent is just an agent directory nested under `subagents/`. It has the
 * same layout as a top-level agent (`config.ts`, `instructions.md`, `tools/*`,
 * and optionally `skills/`, `workspace/`). It is wired into the parent as a
 * delegation tool the model can call by its directory name, `forecaster`.
 *
 * A subagent's `config.ts` MUST set a non-empty `description` — that text is
 * what the parent model sees when deciding whether to delegate. The build fails
 * if it is missing.
 */
export default agentConfig({
  model: 'openai/gpt-5.4-mini',
  description: 'Produces a multi-day weather forecast for a city.',
  // instructions omitted -> taken from instructions.md
  // tools omitted -> taken from tools/*.ts
});
