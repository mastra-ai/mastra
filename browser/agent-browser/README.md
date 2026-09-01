# @mastra/agent-browser

Browser automation for Mastra agents using agent-browser. Use `@mastra/agent-browser` to connect this provider to a Mastra application.

## Installation

```bash
npm install @mastra/agent-browser
```

## Usage

Configure the prerequisites described in the documentation.

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

- [@mastra/agent-browser documentation](https://mastra.ai/reference/browser/agent-browser)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/browser/agent-browser/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
