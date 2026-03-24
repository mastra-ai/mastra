# @mastra/stagehand

AI-powered browser automation for Mastra agents using [Stagehand](https://github.com/browserbase/stagehand).

## Installation

```bash
npm install @mastra/stagehand
```

## Usage

```typescript
import { Agent } from '@mastra/core';
import { StagehandBrowser } from '@mastra/stagehand';

// Create a Stagehand browser
const browser = new StagehandBrowser({
  model: 'openai/gpt-4o',
  headless: true,
});

// Create an agent with the browser
const agent = new Agent({
  name: 'web-agent',
  instructions: 'You are a helpful web assistant.',
  model: { provider: 'openai', modelId: 'gpt-4o' },
  browser,
});

// Use the agent to browse the web with natural language
const result = await agent.generate('Go to google.com and search for "Mastra AI"');
```

## Configuration

```typescript
const browser = new StagehandBrowser({
  // Environment: 'LOCAL' or 'BROWSERBASE'
  env: 'LOCAL',

  // Model for AI operations (default: 'openai/gpt-4o')
  model: 'openai/gpt-4o',
  // Or with custom config:
  model: {
    modelName: 'openai/gpt-4o',
    apiKey: process.env.OPENAI_API_KEY,
  },

  // Run headless (default: true)
  headless: true,

  // CDP URL for connecting to existing browser
  // Can be a string or async function
  cdpUrl: 'ws://localhost:9222',
  // Or dynamic:
  cdpUrl: async () => {
    const session = await browserbase.createSession();
    return session.connectUrl;
  },

  // Browserbase config (when env: 'BROWSERBASE')
  apiKey: process.env.BROWSERBASE_API_KEY,
  projectId: process.env.BROWSERBASE_PROJECT_ID,

  // Logging verbosity (0: silent, 1: errors, 2: verbose)
  verbose: 1,
});
```

## Tools

StagehandBrowser exposes 6 AI-powered tools:

### Core AI Tools

- **stagehand_act** - Perform actions using natural language
- **stagehand_extract** - Extract structured data from pages
- **stagehand_observe** - Discover actionable elements

### Navigation & State

- **stagehand_navigate** - Navigate to a URL
- **stagehand_screenshot** - Take screenshots
- **stagehand_close** - Close the browser

## Comparison with AgentBrowser

| Feature | AgentBrowser | StagehandBrowser |
|---------|--------------|------------------|
| Approach | Deterministic refs ([ref=e1]) | Natural language |
| Token cost | Low | Higher (LLM calls) |
| Speed | Fast | Slower |
| Reliability | High (exact refs) | Variable (AI interpretation) |
| Best for | Structured workflows | Unknown/dynamic pages |

## License

Apache-2.0
