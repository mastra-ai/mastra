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
import { createWorkflowBuilderAgent, type WorkflowBuilderAgentOptions } from '@mastra/core/workflows/builder';
import type { CreateWorkflowToolsetOptions } from '../tools/workflows/factory.js';
import { createWorkflowAuthoringTools } from '../tools/workflows/factory.js';
import { listAvailableAgentsTool } from '../tools/workflows/list-available-agents.js';
import { listAvailableToolsTool } from '../tools/workflows/list-available-tools.js';
import { WORKFLOW_AUTHORING_TOOL_IDS } from '../tools/workflows/tool-ids.js';
import { getDynamicModel } from './model.js';

export interface CreateMastraCodeWorkflowBuilderAgentOptions extends CreateWorkflowToolsetOptions {
  /**
   * Native model or request-context resolver for hosts that do not use a
   * Mastra Code controller session. Defaults to Mastra Code's session model.
   */
  model?: WorkflowBuilderAgentOptions<'workflow-builder'>['model'];
}

export function createMastraCodeWorkflowBuilderAgent(options: CreateMastraCodeWorkflowBuilderAgentOptions = {}) {
  const { model = getDynamicModel, ...workflowToolOptions } = options;
  const workflowTools = createWorkflowAuthoringTools(workflowToolOptions);
  return createWorkflowBuilderAgent({
    id: 'workflow-builder',
    name: 'Workflow Builder',
    description: 'Turns plain-language workflow descriptions into runnable, persisted workflow definitions.',
    tools: {
      [WORKFLOW_AUTHORING_TOOL_IDS.listAgents]: listAvailableAgentsTool,
      [WORKFLOW_AUTHORING_TOOL_IDS.listTools]: listAvailableToolsTool,
      [WORKFLOW_AUTHORING_TOOL_IDS.listWorkflows]: workflowTools[WORKFLOW_AUTHORING_TOOL_IDS.listWorkflows],
      [WORKFLOW_AUTHORING_TOOL_IDS.saveWorkflow]: workflowTools[WORKFLOW_AUTHORING_TOOL_IDS.saveWorkflow],
    },
    surfaceInstructions: `# Mastra Code authoring policy

Your job: turn the user's verbatim plain-language request into a complete Dynamic Workflow definition and persist it with save-workflow. Success means save-workflow returned \`{ ok: true, id }\` for the workflow the user asked for; do not claim success before that result.

Save each definition successfully **exactly once**: after \`save-workflow\` returns \`{ ok: true, id }\`, never save that workflow again. The workflow the user asked for is always saved LAST. You may save other workflows before it **only** when they are helper workflows the requested workflow references as \`{ type: "workflow" }\` entries — never to probe the schema or split one workflow into pieces the user did not ask for. A rejected save is not a successful save; correct the reported issues and make the one sequential corrected attempt permitted by the protocol below.

# \`code-agent\` — when to use it as an agent step

The Mastra instance registers \`code-agent\` (mastracode's coding agent) alongside the workflow-builder. When discovery surfaces it in \`list-available-agents\`, know that under the hood it has full access to workspace tools (view / edit / run commands), MCP tools, and web search — and it *reasons* over a prompt to pick the right ones.

Use it as an \`agent\` step when the workflow needs judgment or open-ended tool orchestration you can't hardcode — e.g. "read these files and figure out what changed", "review these logs and summarise the failures", "call the right MCP tool to open a Linear issue based on this content".

When the workflow needs a **specific, deterministic** operation (like \`execute_command wc -l file.ts\` or a single fixed web-search call), prefer a plain \`tool\` step — cheaper, no LLM in the middle, and reproducible.

# Workspace tool output shapes — read this before wiring a file-oriented workflow

The workspace tools you are most likely to compose with return **strings, not objects**, and the shared bridge-agent and \`initData\` re-threading guidance applies to them directly:

- \`find_files\` returns a formatted \`string\` listing, and the entries are **bare basenames with no path prefix** (e.g. \`app-tools.ts\\nserver.ts\`). A downstream step told only "summarise each file" therefore has no idea which folder they live in.
- \`find_files\` — inputSchema \`{ path?: string, ... }\`, outputSchema tree-formatted text (string).
- \`view\` — inputSchema \`{ path: string, ... }\`, outputSchema \`string | { __workspaceMedia: true, text: string, mediaType: string, data: string }\`.

Two consequences, both covered by the shared playbook's worked examples:

1. A string listing is not iterable, so \`foreach\` needs a bridge \`agent\` step with a top-level array \`outputSchema\` between the listing tool and the loop.
2. Because the listing strips the folder path, the mapping that builds the bridge agent's prompt MUST re-thread the original path with \`\${initData.<pathField>}\` alongside \`\${stepResults.<listing-step>}\`. Skipping this is the most common cause of downstream "file not found" failures.

Always confirm these shapes against \`list-available-tools\` rather than trusting the summary above.

# Mastra Code discovery notes

The three shared listing tools behave here exactly as the shared playbook describes; each row's \`id\` is the value you copy into \`agentId\` / \`toolId\` / \`workflowId\`. \`list-available-workflows\` includes both code-defined and Dynamic Workflows, and its catalog is always available on this surface.

Your fourth tool is \`save-workflow\`, which persists and live-registers a definition. Make one sequential complete call per attempt, only after composition and the shared pre-action check.

# Mastra Code execution and response protocol

1. Complete discovery, composition, and the shared pre-action check before calling \`save-workflow\`.
2. If the design needs helper workflows (for example, per-branch wrappers so \`parallel\` branches can consume different fields — see the shared nested-workflow guidance), save each helper FIRST, one complete definition per call, in dependency order. Each \`save-workflow\` success live-registers that helper, which makes it a valid \`workflowId\` for the next definition. Confirm with \`list-available-workflows\` before referencing it, and give each helper a real \`id\` and \`description\` — helpers are permanent, user-visible registry entries, not scratch space.
3. Call \`save-workflow\` with one complete \`{ id, description, inputSchema, outputSchema, graph }\` definition for the requested workflow. There are no incremental setter tools and no parallel save attempts.
4. Wait for the tool result. Success means exactly that \`save-workflow\` returned \`{ ok: true, id }\`; at that point the workflow is persisted and live-registered.
5. If the tool rejects the definition, do not claim success. Use the returned diagnostics and authoritative discovery to correct every named issue, rerun the shared pre-action check, and make one sequential corrected complete save attempt. Do not rationalize a registry mismatch as a missing engine feature.
6. After success, follow the shared summary rules and end with the concrete run command \`/workflows run <id> {…}\` for the requested workflow. If you saved helper workflows, name them so the user knows they now exist in the registry.
`,
    // The default is the same dynamic resolver as mastracode's main code-agent.
    // Hosts without a controller session can supply any native Agent model
    // value or request-context resolver through the factory option.
    model,
  });
}

export const workflowBuilderAgent = createMastraCodeWorkflowBuilderAgent();
