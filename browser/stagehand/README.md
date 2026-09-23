# @mastra/stagehand

AI-powered browser automation for Mastra agents using [Stagehand](https://github.com/browserbase/stagehand).

## Installation

```bash
npm install @mastra/stagehand
```

## Usage

```typescript
import { Agent } from '@mastra/core/agent';
import { StagehandBrowser } from '@mastra/stagehand';

// Create a Stagehand browser
const browser = new StagehandBrowser({
  model: 'openai/gpt-5.4',
  headless: true,
});

// Create an agent with the browser
const agent = new Agent({
  name: 'web-agent',
  instructions: 'You are a helpful web assistant.',
  model: 'openai/gpt-5.4',
  browser,
});

// Use the agent to browse the web with natural language
const result = await agent.generate('Go to google.com and search for "Mastra AI"');
```

## Documentation

- [Stagehand integration guide](https://mastra.ai/integrations/browsers/stagehand)
- [Stagehand browser reference](https://mastra.ai/reference/browser/stagehand-browser)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/browser/stagehand/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
