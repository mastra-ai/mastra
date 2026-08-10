/**
 * Statically register workflow-related primitives on the mastracode Mastra
 * instance so `mastra.listTools()` + `mastra.listAgents()` — and, therefore,
 * the workflow-builder's discovery + the workflow rehydrator — see everything
 * a workflow might want to compose:
 *
 *   - workflow-builder sub-agent (so `create-workflow` can delegate)
 *   - code-agent (as a plain agent, callable via agent steps)
 *   - workspace tools (view/write/edit/find_files/execute_command/etc.)
 *   - web tools (Tavily-gated) so workflows can compose search/extract steps
 *   - notification_inbox
 *   - snapshot of MCP tools from mcpManager
 *
 * Called after `controller.init()` but before `startWorkers()` in both boot
 * paths, so `loadStoredWorkflows()` (inside startWorkers) sees the full
 * registry when rehydrating previously-saved workflows.
 *
 * Tradeoffs:
 *   - MCP tools are snapshotted. Servers added after boot are invisible to
 *     the workflow-builder until restart.
 *   - Web tool flavor is Tavily-only. Provider-native (Anthropic/OpenAI) web
 *     tools are skipped because they'd freeze workflows to one model provider.
 *   - Workflow tool steps get the closed-over workspace + auth (Tavily key,
 *     MCP server credentials), not per-request permissions — deliberate; if
 *     the user built + saved the workflow they meant to run it.
 */
import type { Agent } from '@mastra/core/agent';
import type { Mastra } from '@mastra/core/mastra';
import { createNotificationInboxTool } from '@mastra/core/notifications';
import { LocalFilesystem, LocalSandbox, Workspace, createWorkspaceTools } from '@mastra/core/workspace';
import { MASTRACODE_WORKSPACE_TOOLS } from '../agents/tool-availability.js';
import { LazyNotificationsStorage } from '../agents/tools.js';
import { workflowBuilderAgent } from '../agents/workflow-builder-agent.js';
import type { McpManager } from '../mcp';
import { MC_TOOLS } from '../tool-names.js';
import { createWebExtractTool, createWebSearchTool, hasTavilyKey } from '../tools/web-search.js';

export interface RegisterWorkflowBuilderPrimitivesOptions {
  projectPath: string;
  /**
   * Extra allowed paths the workspace can read/write. Mastracode normally
   * collects skill paths + sandboxAllowedPaths per-request; for the workflow
   * workspace we accept anything the caller wants up-front and trust the
   * worker process to honour the user's intent.
   */
  allowedPaths?: string[];
  /**
   * The code-agent Agent instance. Registered as `code-agent` so workflows
   * can compose it in agent steps. It already has full dynamic tool access
   * (workspace/MCP/web/etc.) via its own `tools: createDynamicTools(...)`.
   */
  codeAgent: Agent;
  /**
   * McpManager for snapshotting MCP tools at boot. Omit or pass undefined
   * if MCP is disabled — workflow-builder will just see fewer tools.
   */
  mcpManager?: McpManager;
}

export async function registerWorkflowBuilderPrimitives(
  mastra: Mastra,
  options: RegisterWorkflowBuilderPrimitivesOptions,
): Promise<void> {
  const { projectPath, allowedPaths = [], codeAgent, mcpManager } = options;

  // 1. Agents workflows can compose.
  mastra.addAgent(workflowBuilderAgent, 'workflow-builder');
  mastra.addAgent(codeAgent, 'code-agent');

  // 2. Workspace tools — bound to a project-rooted local workspace.
  const workspace = new Workspace({
    id: 'workflow-builder-workspace',
    name: 'Mastra Code Workspace (workflows)',
    filesystem: new LocalFilesystem({
      basePath: projectPath,
      allowedPaths: [projectPath, ...allowedPaths],
    }),
    sandbox: new LocalSandbox({ workingDirectory: projectPath }),
    tools: MASTRACODE_WORKSPACE_TOOLS,
  });
  const workspaceTools = await createWorkspaceTools(workspace, { workspace });
  for (const [toolId, tool] of Object.entries(workspaceTools)) {
    mastra.addTool(tool, toolId);
  }

  // 3. Web tools — Tavily only. Provider-native web tools (Anthropic/OpenAI)
  //    are model-locked and would freeze workflows to one provider.
  if (hasTavilyKey()) {
    mastra.addTool(createWebSearchTool(), 'web-search');
    mastra.addTool(createWebExtractTool(), 'web-extract');
  }

  // 4. notification_inbox — LazyNotificationsStorage resolves the notifications
  //    domain per-call rather than at boot, so it works even when the domain
  //    isn't fully initialised yet.
  const storage = mastra.getStorage();
  if (storage) {
    const notificationInbox = createNotificationInboxTool({
      storage: new LazyNotificationsStorage(storage as never),
    });
    mastra.addTool(notificationInbox, MC_TOOLS.NOTIFICATION_INBOX);
  }

  // 5. MCP tools — snapshot the current set. Ids are already server-namespaced
  //    (`${serverName}_${toolName}`), so the workflow rehydrator's
  //    `mastra.getTool(id)` resolves them at run time.
  if (mcpManager) {
    for (const [toolId, tool] of Object.entries(mcpManager.getTools())) {
      mastra.addTool(tool, toolId);
    }
  }
}
