/**
 * Browser-Use Agent Example
 *
 * Uses BrowserViewer to launch Chrome and browser-use (Python) CLI for automation:
 * - BrowserViewer launches Chrome with a known CDP port
 * - Agent uses workspace_execute_command to run browser-use commands
 * - browser-use connects to our Chrome via --cdp-url
 *
 * Setup:
 *   pip3 install browser-use
 *   npx skills add browser-use/browser-use --skill browser-use --yes
 */
import { Agent } from '@mastra/core/agent';
import { Workspace, LocalSandbox, LocalFilesystem } from '@mastra/core/workspace';
import { BrowserViewer } from '@mastra/browser-viewer';
import { Memory } from '@mastra/memory';

// Create BrowserViewer to manage Chrome
const browserViewer = new BrowserViewer({
  cli: 'browser-use',
  headless: false,
});

const browserUseWorkspace = new Workspace({
  id: 'browser-use-workspace',
  filesystem: new LocalFilesystem({
    basePath: './workspace-data',
  }),
  sandbox: new LocalSandbox({
    workingDirectory: './workspace-data',
  }),
  skills: ['.agents/skills/browser-use'],
  browser: browserViewer,
});

const memory = new Memory();

/**
 * Agent that uses browser-use (Python) for browser automation.
 *
 * browser-use is a full CLI with built-in commands:
 *   bu open <url>          - Navigate to URL
 *   bu click <index>       - Click element by index
 *   bu type <text>         - Type text
 *   bu scroll <direction>  - Scroll page
 *   bu screenshot          - Take screenshot
 *   bu extract <prompt>    - Extract data using AI
 *   bu state               - Get page state
 *   bu close               - Close browser
 */
export const browserUseAgent = new Agent({
  id: 'browser-use-agent',
  name: 'Browser-Use Agent',
  description: 'An agent that uses browser-use (Python) CLI for web automation.',
  instructions: `You are a web browsing assistant with browser automation capabilities.

Use the workspace_execute_command tool to run browser commands. The browser CLI is available for navigation, interaction, and data extraction.

Browser context (current URL, page title) will be provided when available.`,
  model: 'openai/gpt-5.4',
  workspace: browserUseWorkspace,
  memory,
});
