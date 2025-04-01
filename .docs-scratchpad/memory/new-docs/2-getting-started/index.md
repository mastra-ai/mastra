# Getting Started with Memory

Mastra makes it simple to add memory capabilities to your agents. This guide will help you set up memory in your application.

## Installation

To use memory in your Mastra project, install the required package:

```bash
npm install @mastra/memory
# or
pnpm add @mastra/memory
# or
yarn add @mastra/memory
```

By default, Mastra memory uses LibSQL for storage and FastEmbed for embeddings, which are included in the package.

## Adding Memory to an Agent

Basic memory setup requires minimal configuration:

```typescript
import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { openai } from "@ai-sdk/openai";

// Create a memory instance
const memory = new Memory();

// Attach memory to an agent
const agent = new Agent({
  name: "MyAgent",
  instructions: "You are a helpful assistant.",
  model: openai("gpt-4o"),
  memory: memory,
});
```

## Using Memory in Conversations

To use memory, provide `resourceId` and `threadId` when calling the agent:

```typescript
// First interaction
await agent.stream("Hello, my name is Alice.", {
  resourceId: "user_alice",
  threadId: "conversation_123",
});

// Later interaction - memory is automatically retrieved and included
await agent.stream("What's my name again?", {
  resourceId: "user_alice",
  threadId: "conversation_123",
});
```

The agent will automatically:
- Store all messages in the conversation
- Retrieve relevant context in future interactions
- Maintain conversation continuity

## Trying It Out (Playground)

The fastest way to experiment with Mastra's memory system is to use the playground:

1. Start a new Mastra project:
   ```bash
   pnpm create mastra
   ```

2. In your project's `src/mastra/agents/index.ts` file, add memory to your agent:
   ```typescript
   import { Agent } from "@mastra/core/agent";
   import { Memory } from "@mastra/memory";
   import { openai } from "@ai-sdk/openai";

   export const myAgent = new Agent({
     name: "MemoryAgent",
     instructions: "You are a helpful assistant with memory capabilities.",
     model: openai("gpt-4o"),
     memory: new Memory(),
   });
   ```

3. Start the development server:
   ```bash
   pnpm dev
   ```

4. Open the playground at `http://localhost:4111` and interact with your agent.

5. Try referencing earlier parts of the conversation to test the memory functionality.

Continue to [Using Memory](../3-using-memory/index.md) to learn more about advanced memory features. 