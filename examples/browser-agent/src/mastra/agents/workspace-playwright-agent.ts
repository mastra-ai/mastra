/**
 * Workspace Playwright Agent Example
 *
 * This demonstrates using browser capabilities via Workspace:
 * - Uses playwright-mcp CLI for browser automation (@anthropic-ai/playwright-mcp)
 * - BrowserViewer connects to get screencast and URL/title
 * - Agent learns CLI usage from installed skills (auto-installed on init)
 *
 * The CLI handles browser launch/lifecycle. BrowserViewer only observes.
 */
import { Agent } from '@mastra/core/agent';
import { Workspace, LocalSandbox, LocalFilesystem } from '@mastra/core/workspace';
import { Memory } from '@mastra/memory';

/**
 * Create a workspace with browser capabilities using playwright-mcp CLI.
 *
 * The agent uses playwright-mcp commands via workspace_execute_command.
 * BrowserViewer connects to the browser for screencast and context.
 *
 * Skills are auto-installed to .agents/skills when workspace.init() is called.
 */
export const playwrightWorkspace = new Workspace({
  id: 'playwright-workspace',
  filesystem: new LocalFilesystem({
    basePath: process.cwd(),
  }),
  sandbox: new LocalSandbox({
    workingDirectory: process.cwd(),
  }),
  // Skills paths - npx skills add installs to .agents/skills/
  skills: ['.agents/skills/playwright-cli'],
  browser: {
    // Use playwright-mcp CLI for browser automation
    // Skills are auto-installed on workspace.init()
    cli: 'playwright-cli',
    headless: false,
  },
});

// Initialize workspace on module load to ensure browser skill is installed
// This runs when the agent is loaded (e.g., server startup)
playwrightWorkspace.init().catch(err => {
  console.error('Failed to initialize playwright workspace:', err);
});

const memory = new Memory();

/**
 * Agent that uses workspace for browser automation via Playwright MCP.
 *
 * The agent will:
 * 1. Use workspace_execute_command to run playwright-mcp CLI commands
 * 2. Get browser context (current URL, title) injected into prompts
 * 3. Stream screencast for visual feedback (when connected to UI)
 *
 * The agent learns how to use the CLI from the installed skill.
 * Make sure to install: npx skills add microsoft/playwright-mcp --skill playwright
 */
export const workspacePlaywrightAgent = new Agent({
  id: 'workspace-playwright-agent',
  name: 'Workspace Playwright Agent',
  description:
    'An agent that uses playwright-mcp CLI (@anthropic-ai/playwright-mcp) for web automation with screencast viewing.',
  instructions: `You are a web browsing assistant with browser automation capabilities.

Use the workspace_execute_command tool to run browser commands. The playwright-mcp CLI is available for navigation, interaction, and data extraction.

Browser context (current URL, page title) will be provided when available.`,
  model: 'openai/gpt-5.2',
  workspace: playwrightWorkspace,
  memory,
});
