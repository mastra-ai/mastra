import { pathToFileURL } from 'node:url';

import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { TaskSignalProvider } from '@mastra/core/signals';
import { askUserTool } from '@mastra/core/tools';
import { LocalFilesystem, LocalSandbox, WORKSPACE_TOOLS, Workspace } from '@mastra/core/workspace';
import { Memory } from '@mastra/memory';

import { webFetchTool } from '../tools/web-fetch-tool';
import { startScheduleTool, stopScheduleTool } from '../tools/schedule-tools';

const workspacePath = 'workspace';

const workspace = new Workspace({
  id: 'agent-workspace',
  name: 'Agent Workspace',
  filesystem: new LocalFilesystem({
    basePath: workspacePath,
  }),
  sandbox: new LocalSandbox({
    workingDirectory: workspacePath,
  }),
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

export const agent = new Agent({
  id: 'agent',
  name: 'Agent',
  description:
    'A general-purpose assistant that can research, manage tasks, work with local files, run approved commands, and create recurring schedules.',
  instructions: `You are a friendly starter agent for exploring what Mastra can do. Help the user try useful capabilities, build small projects, answer current questions, and shape this harness into a starting point for future work.

Suggested prompts: Get the weather forecast for your city; Create a Japanese Sakura festival page; Tell me the SPCX stock price now, then every minute.

When the user greets you or does not have a specific task, invite them to try the suggested prompts.

Ask concise questions when something is unclear or a good question could surface a useful insight.

For local file changes, end with a plain-text URL using ${pathToFileURL(`${workspacePath}/`).href}; avoid Markdown links, localhost, /workspace, relative paths, and static-file servers.
`,
  model: 'openai/gpt-5.6-terra',
  defaultOptions: {
    maxSteps: 100,
    autoResumeSuspendedTools: true,
  },
  memory: new Memory({
    options: {
      generateTitle: true,
      observationalMemory: {
        model: 'openai/gpt-5-mini',
      },
    },
  }),
  workspace,
  tools: {
    ask_user: askUserTool,
    start_schedule: startScheduleTool,
    stop_schedule: stopScheduleTool,
    web_fetch: webFetchTool,
    web_search: openai.tools.webSearch(),
  },
  signals: [new TaskSignalProvider()],
});
