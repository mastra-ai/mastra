import { pathToFileURL } from 'node:url';
import { tools } from '@mastra/connect';
import { Agent } from '@mastra/core/agent';
import { TaskSignalProvider } from '@mastra/core/signals';
import { askUserTool, webFetchTool } from '@mastra/core/tools';
import { LocalFilesystem, LocalSandbox, WORKSPACE_TOOLS, Workspace } from '@mastra/core/workspace';
import { Memory } from '@mastra/memory';
import { PlatformFilesystem, PlatformSandbox } from '@mastra/platform-workspace';
import { startScheduleTool, stopScheduleTool } from '../tools/schedule-tools';
import { webSearchTool } from '../tools/web-search';
import { platformSetupSkill } from '../skills/platform-setup';
import { createListConnectionsTool } from '../tools/list-connections';
import { getConnectChannels } from '../connect';

const workspacePath = 'workspace';

const hasPlatformCredential = Boolean(
  process.env.MASTRA_PLATFORM_ACCESS_TOKEN?.trim() || process.env.MASTRA_PLATFORM_SECRET_KEY?.trim(),
);
const hasProjectId = Boolean(process.env.MASTRA_PROJECT_ID?.trim());
export const hasConnectEnv = hasPlatformCredential && hasProjectId;

/**
 * Platform workspace primitives activate when their env is present
 * (MASTRA_ENVIRONMENT_ID for the sandbox, MASTRA_PLATFORM_BUCKET_NAME for the
 * filesystem); otherwise the local primitives keep the template bootable with
 * nothing but a database.
 */
const usePlatformSandbox = hasConnectEnv && Boolean(process.env.MASTRA_ENVIRONMENT_ID?.trim());
const usePlatformFilesystem = hasConnectEnv && Boolean(process.env.MASTRA_PLATFORM_BUCKET_NAME?.trim());

const workspace = new Workspace({
  id: 'agent-workspace',
  name: 'Agent Workspace',
  filesystem: usePlatformFilesystem
    ? new PlatformFilesystem({ id: 'agent-workspace-fs' })
    : new LocalFilesystem({ basePath: workspacePath }),
  sandbox: usePlatformSandbox
    ? new PlatformSandbox({ id: 'agent-workspace-sandbox' })
    : new LocalSandbox({ workingDirectory: workspacePath }),
  tools: {
    [WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE]: {
      requireReadBeforeWrite: true,
    },
    [WORKSPACE_TOOLS.FILESYSTEM.EDIT_FILE]: {
      requireReadBeforeWrite: true,
    },
    [WORKSPACE_TOOLS.FILESYSTEM.DELETE]: {
      requireApproval: true,
    },
  },
});

/**
 * Live tool resolver over the Mastra platform project's integration
 * connections: every integration attached to the project (Linear, Notion, …)
 * shows up as agent tools, and connections attached or detached on the
 * platform are picked up without restarting the server.
 *
 * Shared with the activity-digest workflow, which calls it directly. Left
 * undefined when the platform env isn't configured so the harness still boots.
 */
export const connectTools = hasConnectEnv ? tools() : undefined;
export const listConnectionsTool = createListConnectionsTool(connectTools, () => getConnectChannels(hasConnectEnv));

const localFilesNote = usePlatformFilesystem
  ? ''
  : `\n\nFor local file changes, end with a plain-text URL using ${pathToFileURL(`${workspacePath}/`).href}; avoid Markdown links, localhost, /workspace, relative paths, and static-file servers.`;

export const agent = new Agent({
  id: 'agent',
  name: 'Starter Agent',
  description:
    'A general-purpose assistant that can research, manage tasks, work with workspace files, run approved commands, create recurring schedules, and use your connected platform integrations as tools.',
  metadata: {
    suggestedPrompts: [
      "What's the weather in Austin this weekend?",
      'Summarize my open Linear issues.',
      'Build a Japanese sakura festival landing page.',
    ],
  },
  instructions: `You are a friendly starter agent for exploring what Mastra can do. Help the user try useful capabilities, build small projects, answer current questions, and shape this harness into a starting point for future work.

## Integration tools

Tools named \`<integration>_<action>\` (for example \`linear_list_issues\`, \`notion_search\`) come from the user's connected integrations via Mastra Connect. Which integrations are available depends on what is connected to their Mastra platform project, so inspect your tool list before promising anything.

- Activate the platform-setup skill when the user needs help getting set up, finding project settings, or adding a missing integration. They use hosted Studio and the Mastra platform in their browser; do not assume they have code or a terminal.
- Read freely, write carefully: list/get/search tools can be called whenever useful; tools that create, update, or delete things are side effects — state what you're about to do, and if the request is ambiguous, confirm first.
- After a write, include identifiers and URLs returned by the tool so the user can jump straight to the result.

## How to work

Ask concise questions when something is unclear or a good question could surface a useful insight.${localFilesNote}
`,
  model: 'mastra/openai/gpt-6-luna',
  defaultOptions: {
    maxSteps: 100,
    autoResumeSuspendedTools: true,
  },
  memory: new Memory({
    options: {
      generateTitle: true,
      observationalMemory: {
        model: 'mastra/openai/gpt-6-luna',
      },
    },
  }),
  workspace,
  skills: [platformSetupSkill],
  tools: async ({ requestContext, mastra }) => ({
    ask_user: askUserTool,
    list_connections: listConnectionsTool,
    start_schedule: startScheduleTool,
    stop_schedule: stopScheduleTool,
    web_fetch: webFetchTool,
    web_search: webSearchTool,
    ...(connectTools ? await connectTools({ requestContext, mastra }) : {}),
  }),
  signals: [new TaskSignalProvider()],
});
