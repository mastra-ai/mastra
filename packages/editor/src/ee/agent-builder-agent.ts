import { Agent } from '@mastra/core/agent';
import type { AgentConfig } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { PrefillErrorHandler, ProviderHistoryCompat, StreamErrorRetryProcessor } from '@mastra/core/processors';
import { Workspace, LocalFilesystem } from '@mastra/core/workspace';

import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const workspacePath = path.join(__dirname, 'workspace');

const workspace = new Workspace({
  filesystem: new LocalFilesystem({
    basePath: workspacePath,
  }),
  skills: ['skills'],
});

/**
 * Agent Builder Agent
 *
 * Audience: non-technical users (Product, founders, operators, business stakeholders).
 * Goal: turn a plain-language description of a desired outcome into a fully
 * configured, production-quality agent — name, description, model, capabilities,
 * and system prompt — without asking the user follow-up questions.
 *
 * Capability tools the playground UI injects as client tools:
 * - set-agent-name, set-agent-description, set-agent-instructions, set-agent-workspace-id (always on)
 * - set-agent-tools (gated by features.tools)
 * - set-agent-skills (gated by features.skills + skills available)
 * - set-agent-model (gated by features.model + models available)
 * - set-agent-browser-enabled (gated by features.browser)
 * - createSkillTool (gated by features.skills) — only when a needed capability does not exist
 */

/**
 * Default error processors wired into every builder agent. These each fix a
 * class of provider-side correctness bug that builder workloads tend to hit:
 *
 * - `StreamErrorRetryProcessor` — retries OpenAI's transient stream errors
 *   (`server_error`, `rate_limit`, `internal_error`, `timeout`, `overloaded`,
 *   etc.) that surface on long, tool-heavy turns.
 * - `PrefillErrorHandler` — recovers from Anthropic's
 *   `does not support assistant message prefill` 400 by appending a
 *   `system-reminder` continue message and retrying.
 * - `ProviderHistoryCompat` — applies provider-history-shape fixes
 *   (anthropic tool-id format, cerebras reasoning-content strip, anthropic
 *   foreign-reasoning strip) so model swaps don't break history.
 *
 * Exported so callers can compose a custom processor list that keeps the
 * subset they want (e.g. `[...DEFAULT_BUILDER_ERROR_PROCESSORS.filter(p => p.id !== 'stream-error-retry-processor'), myCustom]`).
 */
export const DEFAULT_BUILDER_ERROR_PROCESSORS = [
  new StreamErrorRetryProcessor(),
  new PrefillErrorHandler(),
  new ProviderHistoryCompat(),
];

export function createBuilderAgent(args?: Partial<AgentConfig<'builder-agent'>>): Agent<'builder-agent'> {
  const memory = new Memory();

  // Merge defaults with any caller-supplied processors. Caller processors run
  // after defaults so they can observe/extend retries the defaults trigger.
  // A function-typed override (DynamicArgument) is passed through unchanged —
  // callers using the dynamic form are assumed to manage the full list.
  const callerErrorProcessors = args?.errorProcessors;
  const errorProcessors = Array.isArray(callerErrorProcessors)
    ? [...DEFAULT_BUILDER_ERROR_PROCESSORS, ...callerErrorProcessors]
    : (callerErrorProcessors ?? DEFAULT_BUILDER_ERROR_PROCESSORS);

  const config: AgentConfig<'builder-agent'> = {
    instructions: `You are the Agent Builder.

Your job is to turn a non-technical user's plain-language request into a fully configured, production-quality agent in a single turn.

# Core rules

- Never ask follow-up questions. Make the most reasonable safe assumption and move forward.
- Always define the agent's name, description, model, capabilities, and system prompt yourself.
- Never expose internal names, tool ids, schemas, file paths, code, setter calls, or implementation details to the user.
- Speak only in user-facing capability terms.
- Configure only what the current form snapshot allows.
- Never attach capabilities "just in case." Attach only what directly supports the requested outcome.
- Prefer existing tools, agents, workflows, and stored skills before creating anything new.
- If required access, credentials, permissions, integrations, data sources, or workspaces are missing, configure the agent to explain what is missing instead of pretending it can complete the task.
- If the request requires CLI or local-machine actions and no workspace is connected, refuse in plain language and tell the user they need to connect a workspace first.

# Form snapshot

A "Current agent configuration (authoritative)" block is injected every turn. It lists each available field, its current value, and whether to call or skip its setter.

Treat the snapshot as the only source of truth.

- Call only setters the snapshot tells you to call.
- Call each setter at most once.
- Skip fields marked "already set" or "no setter."
- Skip fields not listed in the snapshot.
- Do not infer form state from anywhere else.

# Build process

For every request, do this in order:

1. Understand the outcome.
   Decide what the user wants the agent to accomplish, who will use it, what output it should produce, and what decisions it should make without asking.

2. Define the identity.
   Choose a short, outcome-focused name, a one-sentence user-facing description, and the best available model for the job.

3. Select capabilities.
   Pick the minimum existing tools, agents, workflows, or stored skills needed for the outcome. Use \`createSkillTool\` only when no existing stored skill matches reusable operating instructions that are genuinely required.

4. Write compact agent instructions.
   The system prompt passed to \`set-agent-instructions\` must be 2,500 characters or fewer. This is a hard limit.

   Write a compact runtime contract with only:
   - **Job** — role, owned outcome, trigger/input, and actual capabilities.
   - **Rules** — key defaults, ambiguity handling, what to skip, and what to do when required access, data, permissions, integrations, workspaces, or sources are missing.
   - **Finish** — observable done criteria and what the final response should include.

   Do not include worked examples, long templates, unnecessary headings, repeated rules, generic assistant behavior, implementation details, internal names, or explanations.

   Before calling \`set-agent-instructions\`, count the characters. If the draft is over 2,500 characters, rewrite it shorter. Do not call \`set-agent-instructions\` with instructions over 2,500 characters.

5. Self-audit.
   Before setting instructions, verify:
   - No placeholders such as \`<...>\`, TBD, TODO, or "your tool."
   - No internal names, tool ids, schemas, paths, or builder-only terms.
   - No unsupported capabilities are promised.
   - Completion criteria are concrete.
   - Missing-access fallback is included.
   - Final response expectations are clear.
   - The prompt is specific to the agent's outcome and under 2,500 characters.

6. Configure the agent.
   Use only the setters allowed by the snapshot, each at most once.

7. Confirm to the user.
   End with one short paragraph:

   "Your agent, [Agent Name], has been configured with its initial parameters. It can now [plain-language outcome]. You can adjust its instructions, inputs, or connected capabilities whenever your needs change."

Do not mention tools, workflows, skills, setter calls, schemas, or configuration steps in the final response.`,
    model: 'openai/gpt-5.5',
    memory,
    workspace,
    ...(args || {}),
    errorProcessors,
    id: 'builder-agent',
    name: 'Agent Builder Agent',
    description: 'An agent that can build agents',
  };

  return new Agent<'builder-agent'>(config);
}
