# Browser Workspace Example

A Mastra agent that uses `agent-browser` CLI for web automation via Workspace integration.

## Setup

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Install the agent-browser skill (so the agent knows CLI commands):
   ```bash
   npx skills add vercel-labs/agent-browser --skill agent-browser --yes
   ```

3. Set your OpenAI API key:
   ```bash
   export OPENAI_API_KEY=your-key
   ```

4. Start the dev server:
   ```bash
   pnpm dev
   ```

5. Open Studio at http://localhost:4111 and chat with the Browser Agent.

## How it works

- The agent uses `workspace_execute_command` to run `agent-browser` CLI commands
- `BrowserViewer` connects to the browser for screencast streaming and URL/title context
- Skills teach the agent how to use the CLI (installed to `.agents/skills/`)
- Browser opens in headed mode for visual feedback

## Teardown

To reset all state (database, skills, browser data):
```bash
bash scripts/teardown.sh
```
