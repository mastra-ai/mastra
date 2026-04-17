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

## Configuration

```typescript
const browser = new AgentBrowser({
  // Run headless (default: true)
  headless: true,

  // Viewport dimensions
  viewport: { width: 1280, height: 720 },

  // Default timeout for operations in ms (default: 30000)
  timeout: 30000,

  // CDP URL for connecting to existing browser
  cdpUrl: 'ws://localhost:9222',

  // Browser instance scope
  // Default: 'thread' for local launch, 'shared' when cdpUrl is provided
  // 'thread': Each thread gets its own browser
  // 'shared': All threads share one browser
  scope: 'thread',

  // Screencast settings for Studio
  screencast: {
    enabled: true,
    format: 'jpeg',
    quality: 80,
  },
});
```

## Tools

AgentBrowser exposes 15 deterministic tools using accessibility tree refs:

### Core Tools

- **browser_goto** - Navigate to a URL
- **browser_snapshot** - Get accessibility tree with element refs (@e1, @e2, etc.)
- **browser_click** - Click an element by ref
- **browser_type** - Type text into an element
- **browser_press** - Press keyboard keys
- **browser_select** - Select option from dropdown
- **browser_scroll** - Scroll the page or element
- **browser_close** - Close the browser

### Extended Tools

- **browser_hover** - Hover over an element
- **browser_back** - Go back in browser history
- **browser_dialog** - Handle browser dialogs (alert, confirm, prompt)
- **browser_wait** - Wait for element state changes
- **browser_tabs** - Manage browser tabs (list, new, switch, close)
- **browser_drag** - Drag and drop elements

### Escape Hatch

- **browser_evaluate** - Execute JavaScript in the page context

## How Refs Work

AgentBrowser uses accessibility tree refs for precise element targeting:

1. Call `browser_snapshot` to get the page structure with refs
2. Find the element you want to interact with
3. Use its ref with other tools

```text
[document] Example Page
  [banner]
    [link @e1] Home
    [link @e2] About
  [main]
    [textbox @e3] Search...
    [button @e4] Submit
```

```typescript
// Type in the search box
{ tool: "browser_type", input: { ref: "@e3", text: "mastra" } }

// Click submit
{ tool: "browser_click", input: { ref: "@e4" } }
```

## Comparison with StagehandBrowser

| Feature     | AgentBrowser             | StagehandBrowser             |
| ----------- | ------------------------ | ---------------------------- |
| Approach    | Deterministic refs (@e1) | Natural language             |
| Token cost  | Low                      | Higher (LLM calls)           |
| Speed       | Fast                     | Slower                       |
| Reliability | High (exact refs)        | Variable (AI interpretation) |
| Best for    | Structured workflows     | Unknown/dynamic pages        |

## Documentation

- [agent-browser guide](https://mastra.ai/docs/browser/agent-browser) - Usage guide
- [AgentBrowser reference](https://mastra.ai/reference/browser/agent-browser) - API reference

## License

Apache-2.0
