---
title: "Memory Processors"
description: "Examples of customizing memory behavior with automatic memory processors and custom implementations."
---

# Memory Processors

Memory processors automatically handle conversation history, semantic recall, and working memory. These examples show how memory processors work and how to create custom memory processors.

## Prerequisites

This example uses the `openai` model. Make sure to add `OPENAI_API_KEY` to your `.env` file.

```bash filename=".env" copy
OPENAI_API_KEY=<your-api-key>
```

And install the following package:

```bash copy
npm install @mastra/libsql
```

## Basic Memory Agent

A simple agent with message history that remembers the last 10 messages:

```typescript filename="src/mastra/agents/basic-memory-agent.ts" showLineNumbers copy
import { Memory } from "@mastra/memory";
import { Agent } from "@mastra/core/agent";
import { openai } from "@ai-sdk/openai";
import { LibSQLStore } from "@mastra/libsql";

export const basicMemoryAgent = new Agent({
  name: "basic-memory-agent",
  instructions:
    "You are a helpful assistant that remembers previous conversations.",
  model: "openai/gpt-4.1",
  memory: new Memory({
    storage: new LibSQLStore({
      url: "file:memory.db",
    }),
    lastMessages: 10, // Automatically adds MessageHistory processor
  }),
});

// Use the agent
const response = await basicMemoryAgent.generate({
  messages: [{ role: "user", content: "My name is Alice" }],
  threadId: "thread-123",
});
```

## Advanced Memory Agent with Semantic Recall

An agent that uses semantic search to find relevant past conversations:

```typescript filename="src/mastra/agents/semantic-memory-agent.ts" showLineNumbers copy
import { Memory } from "@mastra/memory";
import { Agent } from "@mastra/core/agent";
import { openai } from "@ai-sdk/openai";
import { LibSQLStore } from "@mastra/libsql";
import { PineconeVector } from "@mastra/pinecone";
import { OpenAIEmbedder } from "@mastra/openai";

export const semanticMemoryAgent = new Agent({
  name: "semantic-memory-agent",
  instructions:
    "You are an AI assistant with semantic memory. You can recall relevant information from past conversations based on context.",
  model: "openai/gpt-4.1",
  memory: new Memory({
    storage: new LibSQLStore({
      url: "file:memory.db",
    }),
    vector: new PineconeVector({
      apiKey: process.env.PINECONE_API_KEY!,
      environment: "us-east-1",
    }),
    embedder: new OpenAIEmbedder({
      model: "text-embedding-3-small",
      apiKey: process.env.OPENAI_API_KEY!,
    }),
    lastMessages: 5,
    semanticRecall: {
      enabled: true,
      topK: 3, // Retrieve top 3 most relevant messages
    },
  }),
});

// The agent will automatically:
// 1. Search for relevant past messages using embeddings
// 2. Include them in the context
// 3. Create embeddings for new messages for future retrieval
```

## Full-Featured Memory Agent

An agent with all memory features and custom processors:

```typescript filename="src/mastra/agents/full-memory-agent.ts" showLineNumbers copy
import { Memory, MessageHistory } from "@mastra/memory";
import { TokenLimiter, ToolCallFilter } from "@mastra/core/processors";
import { Agent } from "@mastra/core/agent";
import { openai } from "@ai-sdk/openai";
import { LibSQLStore } from "@mastra/libsql";
import { PineconeVector } from "@mastra/pinecone";
import { OpenAIEmbedder } from "@mastra/openai";
import { z } from "zod";

// Define tools for the agent
const weatherTool = {
  name: "getWeather",
  description: "Get the current weather for a location",
  parameters: z.object({
    location: z.string(),
  }),
  execute: async ({ location }: { location: string }) => {
    // Mock weather data
    return { location, temperature: 72, condition: "sunny" };
  },
};

// Create memory instance
const memory = new Memory({
  storage: new LibSQLStore({
    url: "file:memory.db",
  }),
  vector: new PineconeVector({
    apiKey: process.env.PINECONE_API_KEY!,
    environment: "us-east-1",
  }),
  embedder: "openai/text-embedding-3-small",
  lastMessages: 10,
  semanticRecall: {
    enabled: true,
    topK: 5,
  },
  workingMemory: {
    enabled: true,
  },
});

export const fullMemoryAgent = new Agent({
  name: "full-memory-agent",
  instructions:
    "You are an AI assistant with comprehensive memory capabilities. " +
    "You can recall previous conversations, maintain working memory, " +
    "and use tools to help users.",
  model: "openai/gpt-4.1",
  tools: { weatherTool },
  memory,
  // No need to manually add processors for basic filtering!
  // Memory processors run first automatically, then utility processors
});

// Use the agent with streaming
const stream = await fullMemoryAgent.stream({
  messages: [{ role: "user", content: "What's the weather in New York?" }],
  threadId: "thread-456",
  resourceId: "user-789", // For cross-thread message formatting
});

for await (const chunk of stream) {
  process.stdout.write(chunk.text || "");
}
```

**Note:** By default, memory processors run first for input processing, so `ToolCallFilter` and `TokenLimiter` work automatically - messages are saved to memory, then filtered for the LLM. You only need manual processor ordering if you're using guardrails and want them to run BEFORE memory (to prevent invalid content from being saved and to avoid re-validating retrieved content).

## Memory with Guardrails

When using guardrails with memory, place them BEFORE memory processors:

```typescript copy showLineNumbers
import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import {
  ContentModerationProcessor,
  PiiRedactionProcessor,
} from "./guardrails";
import { TokenLimiter } from "@mastra/core/processors";
import { openai } from "@ai-sdk/openai";

const memory = new Memory({
  lastMessages: 10,
  semanticRecall: {
    limit: 5,
    minSimilarity: 0.7,
  },
});

export const guardedMemoryAgent = new Agent({
  name: "guarded-memory-agent",
  instructions:
    "You are a helpful assistant that maintains conversation history",
  model: openai("gpt-4o"),
  memory,
  inputProcessors: [
    // 1. Guardrails first - validate new input
    new ContentModerationProcessor(),
    new PiiRedactionProcessor(),

    // 2. Memory - retrieves past messages (bypasses guardrails)
    memory,

    // 3. Utility processors work automatically after memory
    new TokenLimiter(4000),
  ],
});
```

Benefits of this ordering:

- New user input is validated before being saved to memory
- Retrieved memory content skips guardrail checks (already validated)
- More efficient - guardrails only process new content
- Utility processors like `TokenLimiter` still work automatically

## Related documentation

- [Memory Processors](/docs/memory/memory-processors) - Memory processor concepts and configuration
- [Processors](/docs/agents/processors) - General processor concepts
- [Guardrails](/docs/agents/guardrails) - Security and validation processors
