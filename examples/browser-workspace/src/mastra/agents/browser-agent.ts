/**
 * Workspace Browser Agent Example
 *
 * Uses agent-browser CLI for browser automation via Workspace:
 * - BrowserViewer connects to get screencast and URL/title
 * - Agent learns CLI usage from installed skills
 * - Skills must be installed manually: npx skills add vercel-labs/agent-browser --skill agent-browser --yes
 */
import { Agent } from '@mastra/core/agent';
import { Workspace, LocalSandbox, LocalFilesystem } from '@mastra/core/workspace';
import { Memory } from '@mastra/memory';

const browserWorkspace = new Workspace({
  id: 'browser-workspace',
  filesystem: new LocalFilesystem({
    basePath: './workspace-data',
  }),
  sandbox: new LocalSandbox({
    workingDirectory: './workspace-data',
  }),
  skills: ['.agents/skills/agent-browser'],
  browser: {
    cli: 'agent-browser',
    headless: false,
  },
});

const memory = new Memory();

/**
 * Agent that uses workspace for browser automation.
 *
 * The agent will:
 * 1. Use workspace_execute_command to run agent-browser CLI commands
 * 2. Get browser context (current URL, title) injected into prompts
 * 3. Stream screencast for visual feedback in Studio
 *
 * Setup:
 *   npx skills add vercel-labs/agent-browser --skill agent-browser --yes
 */
export const browserAgent = new Agent({
  id: 'browser-agent',
  name: 'Browser Agent',
  description: 'An agent that uses agent-browser CLI for web automation with screencast viewing.',
  instructions: `You are a web browsing assistant with browser automation capabilities.

Use the workspace_execute_command tool to run browser commands. The browser CLI is available for navigation, interaction, and data extraction.

Browser context (current URL, page title) will be provided when available.`,
  model: 'openai/gpt-4.1',
  workspace: browserWorkspace,
  memory,
});
