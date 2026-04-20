/**
 * Browse-CLI Agent Example
 *
 * Uses BrowserViewer to launch Chrome and browse-cli for automation:
 * - BrowserViewer launches Chrome with a known CDP port
 * - Agent uses workspace_execute_command to run browse commands
 * - browse-cli connects to our Chrome via --cdp-url
 * - Can also connect to Browserbase cloud for remote browsers
 *
 * Setup:
 *   npm install -g @browserbasehq/browse-cli
 *   npx skills add browserbase/skills --skill browser --yes
 */
import { Agent } from '@mastra/core/agent';
import { Workspace, LocalSandbox, LocalFilesystem } from '@mastra/core/workspace';
import { BrowserViewer } from '@mastra/browser-viewer';
import { Memory } from '@mastra/memory';

// Create BrowserViewer to manage Chrome
const browserViewer = new BrowserViewer({
  cli: 'browse-cli',
  headless: false,
});

const browseCLIWorkspace = new Workspace({
  id: 'browse-cli-workspace',
  filesystem: new LocalFilesystem({
    basePath: './workspace-data',
  }),
  sandbox: new LocalSandbox({
    workingDirectory: './workspace-data',
  }),
  skills: ['.agents/skills/browser'],
  browser: browserViewer,
});

const memory = new Memory();

/**
 * Agent that uses browse-cli for browser automation.
 *
 * browse-cli is built on Stagehand and supports both local and Browserbase cloud browsers.
 *
 * Commands:
 *   browse open <url>      - Navigate to URL
 *   browse act "<action>"  - Perform an action using AI (Stagehand)
 *   browse extract "<prompt>" - Extract data using AI
 *   browse observe         - Get observable elements
 *   browse screenshot      - Take screenshot
 *   browse status          - Get browser status and CDP URL
 *   browse close           - Close browser
 */
export const browseCLIAgent = new Agent({
  id: 'browse-cli-agent',
  name: 'Browse-CLI Agent',
  description: 'An agent that uses browse-cli (Stagehand) for AI-powered web automation.',
  instructions: `You are a web browsing assistant with browser automation capabilities.

Use the workspace_execute_command tool to run browser commands. The browser CLI is available for navigation, interaction, and data extraction.

Browser context (current URL, page title) will be provided when available.`,
  model: 'openai/gpt-5.4',
  workspace: browseCLIWorkspace,
  memory,
});
