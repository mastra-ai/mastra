import { agentConfig } from '@mastra/core/agent';

/**
 * File-based agent example.
 *
 * This agent is defined entirely by file convention under
 * `agents/weather-fs/` — there is NO `new Agent()` call and nothing is
 * registered in `src/mastra/index.ts`. `mastra dev` / `mastra build` discover it
 * automatically and register it onto the Mastra instance alongside the
 * code-defined agents in this project.
 *
 * The pieces:
 *   - `config.ts`        → this file (model + any config overrides)
 *   - `instructions.md`  → the agent instructions
 *   - `tools/*.ts`       → each default-exported tool, keyed by filename
 *   - `workspace/`       → seed files mirrored into the agent's workspace
 *
 * `agentConfig` is an identity helper that just gives you typing — `model` and
 * `instructions` are optional here because `instructions.md` supplies the
 * instructions and the default workspace is created automatically.
 */
export default agentConfig({
  model: 'openai/gpt-5.4-mini',
  // instructions omitted -> taken from instructions.md
  // tools omitted -> taken from tools/*.ts
});
