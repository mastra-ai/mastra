# @mastra/agent-browser

Deterministic browser automation for Mastra agents using [agent-browser](https://github.com/vercel-labs/agent-browser).

## Installation

```bash
npm install @mastra/agent-browser
```

## Usage

```typescript
import { Agent } from '@mastra/core/agent';
import { AgentBrowser } from '@mastra/agent-browser';

// Create an AgentBrowser instance
const browser = new AgentBrowser({
  headless: true,
});

// Create an agent with the browser
const agent = new Agent({
  name: 'web-agent',
  instructions: `You are a web automation assistant.
Use browser_snapshot to see the page structure,
then interact with elements using their refs (e.g., @e5).`,
  model: 'openai/gpt-5.4',
  browser,
});

// Use the agent to browse the web
const result = await agent.generate('Go to example.com and click the first link');
```

## Documentation

- [Agent Browser integration guide](https://mastra.ai/integrations/browsers/agent-browser)
- [Agent Browser reference](https://mastra.ai/reference/browser/agent-browser)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/browser/agent-browser/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.

## Remote browser inactivity and saved tabs

An opt-in remote browser can observe trusted page input from another Chrome
connection, such as an interactive viewer. `idleTimeoutMs` closes an inactive
browser on the Mastra server. Agent browser operations, including long waits,
remain protected until they finish. Reading `getActivityState()` does not renew
activity. Its `idleDeadlineAt` lets a client display a countdown; explicit
Continue commands call `recordActivity()` on the existing authenticated browser.

```typescript
const browser = new AgentBrowser({
  scope: 'shared',
  cdpUrl: createRemoteBrowser,
  observeUserActivity: true,
  idleTimeoutMs: 120_000,
  savedTabs: { storage, resourceId: userId, threadId },
});
```

`savedTabs` stores web page URLs and the selected tab in the existing native
thread. Relaunch restores those pages, including when a new browser object reads
the same persistent storage. It does not save forms, cookies or login state.
`restoreTabsOnLaunch: true` enables restoration only within the same browser
object when persistent storage is not configured. State reads and status polling
do not launch another browser.

Input observation uses a private Chrome execution world and does not collect key
values or page text. Script-generated events and passive traffic do not refresh
activity. This observes page content, including embedded frames; external viewer
chrome still needs an explicit activity command for actions that produce no page
input. Enable only after the viewer's complete input path is verified.

The in-process idle deadline cannot survive a stopped server by itself. Remote
providers still require native scheduled cleanup with persisted provider and
billing references. `closeIfIdle(incarnation, timeoutMs)` refuses stale browser
instances and running operations, and allows retry of a failed close. A local
test does not prove provider deletion or financial settlement.
