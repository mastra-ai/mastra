/**
 * Workspace Browser-Use Agent Example
 *
 * This demonstrates using browser capabilities via Workspace:
 * - Uses browser-use CLI for browser automation
 * - BrowserViewer connects to get screencast and URL/title
 * - Agent learns CLI usage from installed skills (auto-installed on init)
 *
 * The CLI handles browser launch/lifecycle. BrowserViewer only observes.
 */
import { Agent } from '@mastra/core/agent';
import { Workspace, LocalSandbox, LocalFilesystem } from '@mastra/core/workspace';

/**
 * Create a workspace with browser capabilities using browser-use CLI.
 *
 * The agent uses browser-use commands via workspace_execute_command.
 * BrowserViewer connects to the browser for screencast and context.
 *
 * Skills are auto-installed to .agents/skills when workspace.init() is called.
 */
export const browserUseWorkspace = new Workspace({
  id: 'browser-use-workspace',
  filesystem: new LocalFilesystem({
    basePath: process.cwd(),
  }),
  sandbox: new LocalSandbox({
    workingDirectory: process.cwd(),
  }),
  // Skills paths - npx skills add installs to .agents/skills/
  skills: ['.agents/skills'],
  browser: {
    // Use browser-use CLI for browser automation
    // Skills are auto-installed on workspace.init()
    cli: 'browser-use',
  },
});

// Initialize workspace on module load to ensure browser skill is installed
// This runs when the agent is loaded (e.g., server startup)
browserUseWorkspace.init().catch(err => {
  console.error('Failed to initialize browser-use workspace:', err);
});

/**
 * Agent that uses workspace for browser automation with browser-use CLI.
 *
 * The agent will:
 * 1. Use workspace_execute_command to run browser-use CLI commands
 * 2. Get browser context (current URL, title) injected into prompts
 * 3. Stream screencast for visual feedback (when connected to UI)
 *
 * The agent learns how to use the CLI from the installed skill.
 * Make sure to install: npx skills add browser-use/browser-use --skill browser-use
 */
export const workspaceBrowserUseAgent = new Agent({
  id: 'workspace-browser-use-agent',
  name: 'Workspace Browser-Use Agent',
  description: 'An agent that uses browser-use CLI for web automation with screencast viewing.',
  instructions: `You are a web browsing assistant with browser automation capabilities.

Use the workspace_execute_command tool to run browser commands. The browser-use CLI is available for navigation, interaction, and data extraction.

Browser context (current URL, page title) will be provided when available.`,
  model: 'openai/gpt-5.2',
  workspace: browserUseWorkspace,
});
