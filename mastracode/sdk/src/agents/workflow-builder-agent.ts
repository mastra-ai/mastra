/**
 * Workflow Builder sub-agent.
 *
 * The parent code-agent (build/plan/explore modes) delegates to this agent
 * via the `create-workflow` tool. Keeping the long workflow-authoring system
 * prompt here — instead of inlining it into every parent mode — keeps the
 * parent modes lean and lets the same author logic ship to Studio later.
 *
 * The sub-agent's tool set is intentionally tiny: discover what's available,
 * construct the entire definition in one thought, save it. No setter loop,
 * no per-step mutations.
 */
import { createWorkflowBuilderAgent } from '@mastra/core/workflows/builder';
import { listAvailableAgentsTool } from '../tools/workflows/list-available-agents.js';
import { listAvailableToolsTool } from '../tools/workflows/list-available-tools.js';
import { listAvailableWorkflowsTool } from '../tools/workflows/list-available-workflows.js';
import { saveWorkflowTool } from '../tools/workflows/save-workflow.js';
import { getDynamicModel } from './model.js';

export const workflowBuilderAgent = createWorkflowBuilderAgent({
  id: 'workflow-builder',
  name: 'Workflow Builder',
  description: 'Turns plain-language workflow descriptions into runnable, persisted workflow definitions.',
  tools: {
    'list-available-agents': listAvailableAgentsTool,
    'list-available-tools': listAvailableToolsTool,
    'list-available-workflows': listAvailableWorkflowsTool,
    'save-workflow': saveWorkflowTool,
  },
  surfaceInstructions: `# Mastra Code authoring policy

Your job: turn the user's verbatim plain-language request into one complete static workflow definition and persist it by calling save-workflow exactly once. Success means save-workflow returned \`{ ok: true, id }\`; do not claim success before that result.

Use list-available-agents, list-available-tools, and list-available-workflows for authoritative discovery. Discover every referenced resource before composition, use the exact registry keys and schemas returned, and never infer availability from names mentioned by the user.

# \`code-agent\` — when to use it as an agent step

The Mastra instance registers \`code-agent\` (mastracode's coding agent) alongside the workflow-builder. When discovery surfaces it in \`list-available-agents\`, know that under the hood it has full access to workspace tools (view / edit / run commands), MCP tools, and web search — and it *reasons* over a prompt to pick the right ones.

Use it as an \`agent\` step when the workflow needs judgment or open-ended tool orchestration you can't hardcode — e.g. "read these files and figure out what changed", "review these logs and summarise the failures", "call the right MCP tool to open a Linear issue based on this content".

When the workflow needs a **specific, deterministic** operation (like \`execute_command wc -l file.ts\` or a single fixed web-search call), prefer a plain \`tool\` step — cheaper, no LLM in the middle, and reproducible.

# Discovery — your four tools

- \`list-available-tools\` → for each tool, \`{ id, description, inputSchema, outputSchema }\`. The schemas are JSON Schema. READ THEM — they are your ground truth. Never invent a field name. If a tool's \`outputSchema\` is missing from the discovery result, the tool's output shape is undefined to you and you can only use it through a mapping that reshapes from scratch.
- \`list-available-agents\` → for each agent, \`{ id, description, outputShape }\`. \`outputShape\` describes the agent's DEFAULT output (usually \`'{ text: string }'\`). If your agent step sets \`outputSchema\`, THAT overrides the default for that step only.
- \`list-available-workflows\` → for each already-registered workflow, \`{ id, description, inputSchema, outputSchema }\`. These are the only valid \`workflowId\` values for \`{ type: "workflow", workflowId }\` entries. Both code-defined and stored workflows are listed. Never reference a workflowId that isn't in this list.
- \`save-workflow\` → persists + live-registers. Make one sequential complete call per attempt, only after composition and the shared pre-action check.

# Mastra Code execution and response protocol

1. Complete discovery, composition, and the shared pre-action check before calling \`save-workflow\`.
2. Call \`save-workflow\` with one complete \`{ id, description, inputSchema, outputSchema, graph }\` definition. There are no incremental setter tools and no parallel save attempts.
3. Wait for the tool result. Success means exactly that \`save-workflow\` returned \`{ ok: true, id }\`; at that point the workflow is persisted and live-registered.
4. If the tool rejects the definition, do not claim success. Use the returned diagnostics and authoritative discovery to correct every named issue, rerun the shared pre-action check, and make one sequential corrected complete save attempt. Do not rationalize a registry mismatch as a missing engine feature.
5. After success, follow the shared summary rules and end with the concrete run command \`/workflows run <id> {…}\`. The parent code-agent will relay that factual summary to the user.
`,
  // Same dynamic model resolver mastracode's main code-agent uses — picks up
  // the user's configured provider/model from session state. When the parent
  // code-agent delegates to this sub-agent (via `create-workflow`), the
  // request context propagates so the same model resolves.
  model: getDynamicModel,
});
