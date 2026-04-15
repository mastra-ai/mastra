# Browser Workspace Example

Demonstrates browser automation in Mastra using different approaches:

1. **CLI Providers** (`BrowserViewer`) — Mastra launches Chrome via Playwright, CLI tools connect to it
2. **SDK Providers** (`AgentBrowser`, `StagehandBrowser`) — SDK manages Chrome directly

## Agents

| Agent | Provider | Description |
|-------|----------|-------------|
| `browser-agent` | CLI: agent-browser | Uses Vercel's agent-browser CLI |
| `browser-use-agent` | CLI: browser-use | Uses Python browser-use CLI |
| `browse-cli-agent` | CLI: browse-cli | Uses Browserbase's Stagehand CLI |
| `sdk-agent-browser` | SDK: @mastra/agent-browser | Direct Playwright SDK |
| `sdk-stagehand` | SDK: @mastra/stagehand | Direct Stagehand SDK |

## Setup

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Install CLI tools and skills (for CLI agents):

   ```bash
   # For agent-browser
   npm install -g agent-browser
   npx skills add vercel-labs/agent-browser --skill agent-browser --yes

   # For browser-use (Python)
   pip3 install browser-use
   npx skills add browser-use/browser-use --skill browser-use --yes

   # For browse-cli
   npm install -g @browserbasehq/browse-cli
   ```

3. Set your OpenAI API key:

   ```bash
   export OPENAI_API_KEY=your-key
   ```

4. Start the dev server:

   ```bash
   pnpm dev
   ```

5. Open Studio at http://localhost:4111 and chat with any of the browser agents.

## How it works

### CLI Providers (BrowserViewer)
- `BrowserViewer` launches Chrome with `--remote-debugging-port`
- Agent uses `workspace_execute_command` to run CLI commands
- CLI connects to our Chrome via `--cdp-url`
- Screencast streams directly from page-level CDP sessions

### SDK Providers (AgentBrowser, StagehandBrowser)
- SDK launches and manages Chrome directly
- Agent uses browser tools (navigate, click, extract, etc.)
- Screencast built into the SDK

## Teardown

To reset all state (database, skills, browser data):

```bash
bash scripts/teardown.sh
```
