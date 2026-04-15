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
  instructions: `You are a web browsing assistant using the browse-cli (powered by Stagehand).

Use workspace_execute_command to run browse commands. The CLI binary is "browse".

Available commands:
- browse open <url> - Navigate to a URL
- browse act "<action description>" - Perform an action using AI (e.g., "click the login button")
- browse extract "<what to extract>" - Extract data using AI (e.g., "the main headline")
- browse observe - Get a list of observable/interactive elements
- browse screenshot - Take a screenshot
- browse status - Get browser status (running state, CDP URL)
- browse close - Close the browser

The "act" and "extract" commands use AI to understand the page and perform actions:
- browse act "click the sign in button"
- browse act "fill in the search box with 'mastra ai'"
- browse extract "all product names and prices"
- browse extract "the author's name from this article"

When interacting with pages:
1. Use "browse open <url>" to navigate
2. Use "browse observe" to see what elements are available
3. Use "browse act" for AI-powered interactions
4. Use "browse extract" to get structured data

Browser context (current URL, page title) will be provided when available.`,
  model: 'openai/gpt-4.1',
  workspace: browseCLIWorkspace,
  memory,
});
