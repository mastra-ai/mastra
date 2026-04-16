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

## Configuration

```typescript
const browser = new StagehandBrowser({
  // Environment: 'LOCAL' or 'BROWSERBASE'
  env: 'LOCAL',

  // Model for AI operations (default: 'openai/gpt-5.4')
  model: 'openai/gpt-5.4',
  // Or with custom config:
  model: {
    modelName: 'gpt-5.4',
    apiKey: process.env.OPENAI_API_KEY,
  },

  // Run headless (default: true)
  headless: true,

  // Viewport dimensions
  viewport: { width: 1280, height: 720 },

  // CDP URL for connecting to existing browser
  cdpUrl: 'ws://localhost:9222',

  // Browserbase config (when env: 'BROWSERBASE')
  apiKey: process.env.BROWSERBASE_API_KEY,
  projectId: process.env.BROWSERBASE_PROJECT_ID,

  // Enable self-healing selectors (default: true)
  selfHeal: true,

  // DOM settle timeout in ms (default: 5000)
  domSettleTimeout: 5000,

  // Logging verbosity (0: silent, 1: errors, 2: verbose)
  verbose: 1,

  // Custom system prompt for AI operations
  systemPrompt: 'Focus on finding interactive elements',
});
```

## Tools

StagehandBrowser exposes 6 AI-powered tools:

### Core AI Tools

- **stagehand_act** - Perform actions using natural language instructions
- **stagehand_extract** - Extract structured data from pages
- **stagehand_observe** - Discover actionable elements on the page

### Navigation & State

- **stagehand_navigate** - Navigate to a URL
- **stagehand_tabs** - List, switch, open, or close browser tabs
- **stagehand_close** - Close the browser

## Comparison with AgentBrowser

| Feature     | AgentBrowser             | StagehandBrowser             |
| ----------- | ------------------------ | ---------------------------- |
| Approach    | Deterministic refs (@e1) | Natural language             |
| Token cost  | Low                      | Higher (LLM calls)           |
| Speed       | Fast                     | Slower                       |
| Reliability | High (exact refs)        | Variable (AI interpretation) |
| Best for    | Structured workflows     | Unknown/dynamic pages        |

## Documentation

- [Stagehand guide](https://mastra.ai/docs/browser/stagehand) - Usage guide
- [StagehandBrowser reference](https://mastra.ai/reference/browser/stagehand-browser) - API reference

## License

Apache-2.0
