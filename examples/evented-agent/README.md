# Evented Agent Example

This example demonstrates durable agents using the built-in evented workflow engine. Unlike the Inngest example which requires an external dev server, this uses Mastra's built-in workflow engine for durable execution.

## Overview

The evented agent pattern provides:

- **Durable execution**: The agentic loop runs as a workflow that can be resumed if interrupted
- **Fire-and-forget execution**: Workflows run asynchronously via pubsub
- **Streaming via pubsub**: Results stream back through EventEmitterPubSub
- **No external dependencies**: Uses the built-in workflow engine

## Usage

### 1. Install dependencies

```bash
pnpm install
```

### 2. Set up environment variables

Create a `.env` file with your OpenAI API key:

```
OPENAI_API_KEY=your-key-here
```

### 3. Start the dev server

```bash
pnpm mastra:dev
```

### 4. Use the agents

The agents are available through the Mastra server API:

```typescript
// Using the research agent
const response = await fetch('http://localhost:3000/api/agents/research-agent/stream', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    messages: [{ role: 'user', content: 'Research the latest trends in AI' }],
  }),
});

// Stream the response
const reader = response.body.getReader();
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  console.log(new TextDecoder().decode(value));
}
```

## Agents

### Research Agent

A simple agent that can search the web and summarize findings. Demonstrates basic durable agent usage.

### File Manager Agent

An agent that can read and write files. The write tool requires approval, demonstrating the tool approval workflow with durable execution.

## Comparison with Inngest

| Feature | Evented Agent | Inngest Agent |
|---------|--------------|---------------|
| External dependency | None | Inngest Dev Server |
| Execution | In-process async | External process |
| State persistence | Workflow engine | Inngest |
| Setup complexity | Low | Medium |

The evented agent is simpler to set up but runs in the same process. Inngest provides external process management and more robust state persistence.

## Code Structure

```
src/mastra/
├── index.ts                    # Mastra configuration
└── agents/
    ├── research-agent.ts       # Research agent with web search
    └── file-manager-agent.ts   # File manager with approval
```
