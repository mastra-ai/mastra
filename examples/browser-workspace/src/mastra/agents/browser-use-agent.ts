/**
 * Browser-Use Agent Example
 *
 * Uses PlaywrightViewer to launch Chrome and browser-use (Python) CLI for automation:
 * - PlaywrightViewer launches Chrome with a known CDP port
 * - Agent uses workspace_execute_command to run browser-use commands
 * - browser-use connects to our Chrome via --cdp-url
 *
 * Setup:
 *   pip3 install browser-use
 *   npx skills add browser-use/browser-use --skill browser-use --yes
 */
import { Agent } from '@mastra/core/agent';
import { Workspace, LocalSandbox, LocalFilesystem } from '@mastra/core/workspace';
import { PlaywrightViewer } from '@mastra/browser-viewer';
import { Memory } from '@mastra/memory';

// Create PlaywrightViewer to manage Chrome
const browserViewer = new PlaywrightViewer({
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
  // TODO: Pass browserViewer to workspace once integration is complete
  // browser: browserViewer,
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
  instructions: `You are a web browsing assistant using the browser-use CLI.

Use workspace_execute_command to run browser-use commands. The CLI binary is "bu" or "browser-use".

Available commands:
- bu open <url> - Navigate to a URL
- bu click <index> - Click an element by its index number
- bu type <text> - Type text into the focused element
- bu input <index> <text> - Type text into a specific element
- bu scroll up|down - Scroll the page
- bu back - Go back in history
- bu screenshot - Take a screenshot
- bu state - Get current page state (viewport, scroll position, DOM)
- bu extract "<prompt>" - Extract data from the page using AI
- bu get title - Get the page title
- bu get html - Get the page HTML
- bu close - Close the browser

When interacting with pages:
1. First use "bu open <url>" to navigate
2. Use "bu state" to see the page structure and element indices
3. Use "bu click <index>" to interact with elements
4. Use "bu type <text>" to enter text

Browser context (current URL, page title) will be provided when available.`,
  model: 'openai/gpt-4.1',
  workspace: browserUseWorkspace,
  memory,
});
